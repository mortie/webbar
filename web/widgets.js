class Label extends ModComponent {
	render(props, state) {
		return this.el(props.text);
	}
};

class Battery extends ModComponent {
	constructor() {
		super();
		this.setState({ percent: "?" });
	}

	componentDidMount() {
		let proc = new IPCProc(IPC_EXEC_SH, `
			full="$(cat /sys/class/power_supply/BAT0/charge_full)"
			while read; do
				now="$(cat /sys/class/power_supply/BAT0/charge_now)"
				echo "($now / $full) * 100" | bc -l
				sleep 2;
			done
		`, msg => this.setState({ percent: Math.round(parseFloat(msg)) }));

		onUpdate(() => proc.send("\n"));
	}

	render(props, state) {
		return this.el(`Bat: ${state.percent}%`);
	}
}

class Wireless extends ModComponent {
	constructor() {
		super();
		this.setState({ connection: "--" });
	}

	componentDidMount() {
		let proc = new IPCProc(IPC_EXEC_SH, `
			while read; do
				nmcli device status | grep 'wifi\\s\\+connected' | awk '{print $4}'
			done
		`, msg => this.setState({ connection: msg.trim() }));

		onUpdate(() => proc.send("\n"));
	}

	render(props, state) {
		return this.el(`WiFi: ${state.connection}`);
	}
}

class Memory extends ModComponent {
	constructor() {
		super();
		this.setState({ parts: [ 0, 0 ] });
	}

	componentDidMount() {
		let proc = new IPCProc(IPC_EXEC_SH, `
			while read; do
				free | grep '^Mem' | awk  '{print $2 " " $7}'
			done
		`, msg => this.setState({ parts: msg.split(" ") }));

		onUpdate(() => proc.send("\n"));
	}

	render(props, state) {
		let total = parseInt(state.parts[0]);
		let available = parseInt(state.parts[1]);
		let fracUsed = 1 - (available / total);
		return this.el(`Mem: ${Math.round(fracUsed * 100)}%`);
	}
}

class Processor extends ModComponent {
	constructor() {
		super();
		this.setState({ percent: 0 });
	}

	componentDidMount() {
		let proc = new IPCProc(IPC_EXEC_SH, `
			total() {
				echo "$1" | awk '{print $2 + $3 + $4 + $5 + $6 + $7 + $8}'
			}
			idle() {
				echo "$1" | cut -d' ' -f6
			}
			prev="$(cat /proc/stat | head -n 1)"
			while read; do
				now="$(cat /proc/stat | head -n 1)"
				prevtotal="$(total "$prev")"
				previdle="$(idle "$prev")"
				nowtotal="$(total "$now")"
				nowidle="$(idle "$now")"

				deltatotal=$(($nowtotal - $prevtotal))
				deltaidle=$(($nowidle - $previdle))
				echo "(1 - ($deltaidle / $deltatotal)) * 100" | bc -l
				prev="$now"
			done
		`, msg => this.setState({ percent: Math.round(parseFloat(msg)) }));

		onUpdate(() => proc.send("\n"));
	}

	render(props, state) {
		return this.el(`CPU: ${state.percent}%`);
	}
}

class Time extends ModComponent {
	constructor() {
		super();
		this.setState({ now: new Date() });
	}

	componentDidMount() {
		onUpdate(() => this.setState({ now: new Date() }));
	}

	defaultFmt(d) {
		return d.toDateString()+", "+
			d.getHours().toString().padStart(2, "0")+":"+
			d.getMinutes().toString().padStart(2, "0");
	}

	render(props, state) {
		let func = props.func || this.defaultFmt;
		return this.el(func(state.now));
	}
}

class I3Workspaces extends ModComponent {
	constructor() {
		super();
		this.setState({ workspaces: [] });
	}

	componentDidMount() {
		let proc = new IPCProc(IPC_EXEC_PYTHON, `
			import socket
			import sys
			import subprocess
			import struct
			import json

			try:
				sockpath = str(subprocess.check_output([ "i3", "--get-socketpath" ]), "utf-8").strip()
			except:
				sockpath = str(subprocess.check_output([ "sway", "--get-socketpath" ]), "utf-8").strip()

			sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
			sock.connect(sockpath)

			magic = b"i3-ipc"

			I3_GET_WORKSPACES = 1
			I3_SUBSCRIBE = 2

			def send(t, payload):
				if payload == None:
					msg = magic + struct.pack("=II", 0, t)
				else:
					msg = magic + struct.pack("=II", len(payload), t) + bytes(payload, "utf-8")
				sock.sendall(msg)

			def recv():
				fmt = "=" + str(len(magic)) + "xII"
				head = sock.recv(struct.calcsize(fmt))
				l, t = struct.unpack(fmt, head)
				payload = sock.recv(l)
				return payload, t

			def ipcsend(t, payload):
				sys.stdout.buffer.write(bytes(hex(t), "utf-8") + b":" + payload + b"\\n")
				sys.stdout.flush()

			send(I3_SUBSCRIBE, '["workspace"]')
			if recv()[0] != b'{"success":true}':
				raise Exception("Failed to subscribe for workspace events: " + str(resp))

			send(I3_GET_WORKSPACES, None)

			while True:
				payload, t = recv()
				if t == 1:
					ipcsend(t, payload)
				else:
					obj = json.loads(payload)
					if obj["change"] == "rename":
						send(I3_GET_WORKSPACES, None)
					else:
						ipcsend(t, payload)
		`, this.onMsg.bind(this));
	}

	onMsg(msg) {
		let type = msg.split(":")[0];
		let data = JSON.parse(msg.substr(type.length + 1));
		if (type == "0x1") {
			this.state.workspaces = [];
			data.forEach(ws => this.state.workspaces[ws.num] = ws);
			this.setState(this.state);
		} else if (type == "0x80000000") {
			if (data.change == "focus") {
				if (data.old) {
					this.state.workspaces[data.old.num] = data.old;
					this.state.workspaces[data.old.num].focused = false;
				}
				this.state.workspaces[data.current.num] = data.current;
				this.state.workspaces[data.current.num].focused = true;
				this.setState(this.state);
			} else if (data.change == "empty") {
				delete this.state.workspaces[data.current.num];
				this.setState(this.state);
			}
		}
	}

	render(props, state) {
		return this.el(
			state.workspaces.map(ws => {
				let className = "workspace ";
				if (ws.focused) className += "focused ";
				if (ws.urgent) className += "urgent ";
				return h("div", { className }, ws.name);
			}));
	}
}

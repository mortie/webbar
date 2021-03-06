config({
	updateTime: 2000,
});

css(THEME_DARK);

init(
	h(Group, null, h(I3Workspaces, { scroll: true })),
	h(Group, null,
		h(Audio),
		h(Disk),
		h(Network),
		h(Battery),
		h(Memory),
		h(Processor),
		h(Time),
		h(Drawer, null,
			h(Launcher, { text: "Firefox", cmd: "blueman-manager" }),
			h(Launcher, { text: "Bluetooth", cmd: "blueman-manager" }),
		),
	),
);

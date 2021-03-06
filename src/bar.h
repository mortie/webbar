#ifndef BAR_H
#define BAR_H

#include <gtk/gtk.h>
#include <webkit2/webkit2.h>

#include "ipc.h"

struct bar_win {
	GtkWidget *win;
	WebKitWebView *webview;
	GdkMonitor *mon;
	struct ipc ipc;
};

struct bar {
	int bar_height;
	enum { LOCATION_TOP, LOCATION_BOTTOM } location;
	char *rcfile;
	char *rcdir;
	char *monitor;
	int debug;

	GtkApplication *app;
	struct bar_win *wins;
	size_t wins_len;
	size_t wins_size;
};

void bar_init(struct bar *bar, GtkApplication *app);
void bar_free(struct bar *bar);
void bar_trigger_update(struct bar *bar);

#endif

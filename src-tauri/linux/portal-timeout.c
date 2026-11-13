/*
 * portal-timeout shim
 * -------------------
 * gets loaded with LD_PRELOAD into the desktop app (WebKitGTK is linked into the
 * app process, so its portal calls pass through libgio here).
 *
 * Why: WebKitGTK 2.54.x drives the ScreenCast portal from
 *   Source/WebCore/platform/mediastream/gstreamer/DesktopPortal.cpp
 * with a hardcoded
 *   static const Seconds s_dbusCallTimeout = 10_ms;
 * for every call (CreateSession, SelectSources, Start, OpenPipeWireRemote).
 * `OpenPipeWireRemote` is where xdg-desktop-portal(-gnome) opens the PipeWire
 * connection and hands the fd back, which routinely takes more than 10 ms on
 * a busy desktop, so `getDisplayMedia()` dies with
 *   "Unable to open pipewire remote. Error: Timeout was reached"
 * and WebKit bails out before registering the session, leaking it (mutter keeps
 * cam-streaming the picked screen, so every retry gets slower).
 *
 * What it does: raises the timeout of every call made to
 * org.freedesktop.portal.Desktop. It never shortens a timeout and touches no
 * other bus traffic.
 *
 * Build: see scripts/tauri-dev-linux.sh
 * Debug: PORTAL_TIMEOUT_SHIM_VERBOSE=1 prints every patched call to stderr.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <gio/gio.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define PORTAL_NAME "org.freedesktop.portal.Desktop"
#define NEW_TIMEOUT_MS 30000

static int is_portal_proxy(GDBusProxy *proxy)
{
    if (!proxy)
        return 0;
    const char *name = g_dbus_proxy_get_name(proxy);
    return name && strcmp(name, PORTAL_NAME) == 0;
}

static int patched_timeout(GDBusProxy *proxy, const char *method, int timeout_msec)
{
    if (!is_portal_proxy(proxy))
        return timeout_msec;
    if (timeout_msec >= 0 && timeout_msec < NEW_TIMEOUT_MS) {
        if (getenv("PORTAL_TIMEOUT_SHIM_VERBOSE"))
            fprintf(stderr, "[portal-timeout] %s: %d ms -> %d ms\n", method, timeout_msec, NEW_TIMEOUT_MS);
        return NEW_TIMEOUT_MS;
    }
    return timeout_msec;
}

GVariant *g_dbus_proxy_call_sync(GDBusProxy *proxy, const gchar *method, GVariant *parameters,
    GDBusCallFlags flags, gint timeout_msec, GCancellable *cancellable, GError **error)
{
    static GVariant *(*real_fn)(GDBusProxy *, const gchar *, GVariant *, GDBusCallFlags, gint,
        GCancellable *, GError **);
    if (!real_fn)
        real_fn = dlsym(RTLD_NEXT, "g_dbus_proxy_call_sync");
    return real_fn(proxy, method, parameters, flags, patched_timeout(proxy, method, timeout_msec),
        cancellable, error);
}

GVariant *g_dbus_proxy_call_with_unix_fd_list_sync(GDBusProxy *proxy, const gchar *method,
    GVariant *parameters, GDBusCallFlags flags, gint timeout_msec, GUnixFDList *fd_list,
    GUnixFDList **out_fd_list, GCancellable *cancellable, GError **error)
{
    static GVariant *(*real_fn)(GDBusProxy *, const gchar *, GVariant *, GDBusCallFlags, gint,
        GUnixFDList *, GUnixFDList **, GCancellable *, GError **);
    if (!real_fn)
        real_fn = dlsym(RTLD_NEXT, "g_dbus_proxy_call_with_unix_fd_list_sync");
    return real_fn(proxy, method, parameters, flags, patched_timeout(proxy, method, timeout_msec),
        fd_list, out_fd_list, cancellable, error);
}

void g_dbus_proxy_call_with_unix_fd_list(GDBusProxy *proxy, const gchar *method,
    GVariant *parameters, GDBusCallFlags flags, gint timeout_msec, GUnixFDList *fd_list,
    GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data)
{
    static void (*real_fn)(GDBusProxy *, const gchar *, GVariant *, GDBusCallFlags, gint,
        GUnixFDList *, GCancellable *, GAsyncReadyCallback, gpointer);
    if (!real_fn)
        real_fn = dlsym(RTLD_NEXT, "g_dbus_proxy_call_with_unix_fd_list");
    real_fn(proxy, method, parameters, flags, patched_timeout(proxy, method, timeout_msec), fd_list,
        cancellable, callback, user_data);
}

/* Async no-fd variant: WebKit drives CreateSession/SelectSources/Start through
 * this one. It normally returns fast, but under load it can still blow the
 * 10 ms budget and make getDisplayMedia() abort the whole portal exchange. */
void g_dbus_proxy_call(GDBusProxy *proxy, const gchar *method, GVariant *parameters,
    GDBusCallFlags flags, gint timeout_msec, GCancellable *cancellable,
    GAsyncReadyCallback callback, gpointer user_data)
{
    static void (*real_fn)(GDBusProxy *, const gchar *, GVariant *, GDBusCallFlags, gint,
        GCancellable *, GAsyncReadyCallback, gpointer);
    if (!real_fn)
        real_fn = dlsym(RTLD_NEXT, "g_dbus_proxy_call");
    real_fn(proxy, method, parameters, flags, patched_timeout(proxy, method, timeout_msec),
        cancellable, callback, user_data);
}

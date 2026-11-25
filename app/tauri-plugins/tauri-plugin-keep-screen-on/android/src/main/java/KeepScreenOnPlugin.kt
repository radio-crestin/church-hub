package net.curiana.keepScreenOn

import android.app.Activity
import android.view.WindowManager
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import app.tauri.Logger

@InvokeArg
class KeepScreenOnRequest {
    var enable: Boolean = false
}

@TauriPlugin
class KeepScreenOnPlugin(private val activity: Activity): Plugin(activity) {

    @Command
    fun keepScreenOn(invoke: Invoke) {
        val enable = invoke.parseArgs(Boolean::class.java)
        
        if (enable) {
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        invoke.resolve()
    }
}

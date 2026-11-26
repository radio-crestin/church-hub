package com.plugin.screenbrightness

import android.app.Activity
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class SetBrightnessArgs {
    var value: Float = 1f
}

/**
 * The kiosk's screen dimming on Android: this window's brightness, which the
 * system restores when the app leaves the screen (no WRITE_SETTINGS needed).
 */
@TauriPlugin
class ScreenBrightnessPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun setBrightness(invoke: Invoke) {
        val args = invoke.parseArgs(SetBrightnessArgs::class.java)
        activity.runOnUiThread {
            val attributes = activity.window.attributes
            attributes.screenBrightness = args.value.coerceIn(0f, 1f)
            activity.window.attributes = attributes
            invoke.resolve()
        }
    }

    @Command
    fun getBrightness(invoke: Invoke) {
        val own = activity.window.attributes.screenBrightness
        // Negative: the window follows the system brightness (0-255).
        val brightness = if (own >= 0) own else Settings.System.getInt(
            activity.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 255
        ) / 255f
        val result = JSObject()
        result.put("brightness", brightness.toDouble())
        invoke.resolve(result)
    }
}

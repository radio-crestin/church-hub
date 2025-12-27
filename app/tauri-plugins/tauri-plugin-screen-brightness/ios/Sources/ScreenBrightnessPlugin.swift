import UIKit
import Tauri

struct SetBrightnessArgs: Decodable {
    let value: Float
}

class ScreenBrightnessPlugin: Plugin {
    @objc public func setBrightness(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SetBrightnessArgs.self)
        let brightness = max(0.0, min(1.0, CGFloat(args.value)))

        // Must be called on main thread
        DispatchQueue.main.async {
            UIScreen.main.brightness = brightness
            invoke.resolve()
        }
    }

    @objc public func getBrightness(_ invoke: Invoke) throws {
        DispatchQueue.main.async {
            let brightness = Float(UIScreen.main.brightness)
            invoke.resolve(["brightness": brightness])
        }
    }
}

@_cdecl("init_plugin_screen_brightness")
func initPlugin() -> Plugin {
    return ScreenBrightnessPlugin()
}

import UIKit
import Tauri

class ScreenBrightnessPlugin: Plugin {
    @objc public func setBrightness(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SetBrightnessArgs.self)
        let brightness = max(0.0, min(1.0, args.value))

        DispatchQueue.main.async {
            UIScreen.main.brightness = CGFloat(brightness)
        }

        invoke.resolve()
    }

    @objc public func getBrightness(_ invoke: Invoke) throws {
        let brightness = Float(UIScreen.main.brightness)
        invoke.resolve(["brightness": brightness])
    }
}

struct SetBrightnessArgs: Decodable {
    let value: Float
}

@_cdecl("init_plugin_screen_brightness")
func initPlugin() -> Plugin {
    return ScreenBrightnessPlugin()
}

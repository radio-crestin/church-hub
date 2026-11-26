import SwiftRs
import Tauri
import UIKit
import WebKit
	
class KeepScreenOnArgs: Decodable {
  let enable: Bool
}

class KeepScreenOnPlugin: Plugin {
  @objc public func keepScreenOn(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(Bool.self)
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = args
    }
    invoke.resolve()
  }
}

@_cdecl("init_plugin_keep_screen_on")
func initPlugin() -> Plugin {
  return KeepScreenOnPlugin()
}

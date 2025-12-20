# OBS-Studio python scripts

# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

# OBS_Projector_Hotkeys.py
# Exposes hotkeys for showing Windowed and Fullscreen Projector (Preview)

import obspython as obs
import base64


# ------------------------------------------------------------

class GeometryHolder():
    geometry = ""


geometry_holder = GeometryHolder()
fullscreen_monitor = 0
windowed_monitor = 0


def fullscreen_preview(is_pressed):
    global fullscreen_monitor
    print('fullscreen', fullscreen_monitor)
    if is_pressed:
        obs.obs_frontend_open_projector('Preview', fullscreen_monitor, '', '')


def hide_fullscreen_preview(is_pressed):
    global fullscreen_monitor
    print('fullscreen', fullscreen_monitor)
    if is_pressed:
        obs.obs_frontend_open_projector('Multiview', fullscreen_monitor, '', '')


def windowed_preview(is_pressed):
    if is_pressed:
        obs.obs_frontend_open_projector('Preview', -1, geometry_holder.geometry, '')


hotkeys = {
    'show_fullscreen': {
        'name': 'fullscreen_preview',
        'description': 'Show Fullscreen Projector (Preview)',
        'id': obs.OBS_INVALID_HOTKEY_ID,
        'function': fullscreen_preview,
    },
    'hide_fullscreen': {
        'name': 'fullscreen_preview',
        'description': 'Hide Fullscreen Projector (Preview)',
        'id': obs.OBS_INVALID_HOTKEY_ID,
        'function': hide_fullscreen_preview,
    },
    'windowed': {
        'name': 'windowed_preview',
        'description': 'Show Windowed Projector (Preview)',
        'id': obs.OBS_INVALID_HOTKEY_ID,
        'function': windowed_preview,
    },
}


def script_load(settings):
    # obs_hotkey_register_frontend(name, description, callback)
    # Adds a frontend hotkey. The callback takes one parameter: a boolean ‘pressed’ parameter.
    for key, values in hotkeys.items():
        values['id'] = obs.obs_hotkey_register_frontend(
            values['name'], values['description'], values['function'])
        the_data_array = obs.obs_data_get_array(settings, values['name'])
        obs.obs_hotkey_load(values['id'], the_data_array)
        obs.obs_data_array_release(the_data_array)


def script_save(settings):
    # save hotkeys in script properties
    for key, values in hotkeys.items():
        # undocumented, libobs/obs-hotkey.c, gets data array for given hotkey id
        the_data_array = obs.obs_hotkey_save(values['id'])
        obs.obs_data_set_array(settings, values['name'], the_data_array)
        obs.obs_data_array_release(the_data_array)


def script_update(settings):
    x = obs.obs_data_get_int(settings, 'ref_x')
    y = obs.obs_data_get_int(settings, 'ref_y')
    width = obs.obs_data_get_int(settings, 'width')
    height = obs.obs_data_get_int(settings, 'height')
    reference_corner = obs.obs_data_get_string(settings, 'reference_corner')
    top_left_x, top_left_y = x, y
    btm_right_x, btm_right_y = x + width, y + height
    match reference_corner:
        case 'Top Left':
            top_left_x, top_left_y = x, y
            btm_right_x, btm_right_y = x + width, y + height
        case 'Top Right':
            top_left_x, top_left_y = x - width, y
            btm_right_x, btm_right_y = x, y + height
        case 'Bottom Left':
            top_left_x, top_left_y = x, y - height
            btm_right_x, btm_right_y = x + width, y
        case 'Bottom Right':
            top_left_x, top_left_y = x - width, y - height
            btm_right_x, btm_right_y = x, y

    rect = b''.join((top_left_x.to_bytes(4, 'big'),
                     top_left_y.to_bytes(4, 'big'),
                     btm_right_x.to_bytes(4, 'big'),
                     btm_right_y.to_bytes(4, 'big'),
                     ))

    geometry_holder.geometry = base64.b64encode(
        b''.join(
            (
                bytes.fromhex("01d9d0cb00030000"),  # not sure what this is
                rect,
                rect,
                obs.obs_data_get_int(settings, 'windowed_monitor').to_bytes(4, 'big'),
                bytes.fromhex("000000000000"),
                rect,
            )
        )
    ).decode('utf-8')
    global fullscreen_monitor, windowed_monitor
    fullscreen_monitor = obs.obs_data_get_int(settings, 'fullscreen_monitor')
    windowed_monitor = obs.obs_data_get_int(settings, 'windowed_monitor')


def open_windowed_button(props, prop):
    print(props)
    print(prop)
    windowed_preview(True)
    windowed_preview(False)


def script_properties():
    # print("script props")
    props = obs.obs_properties_create()

    obs.obs_properties_add_text(props, 'fullscreen_heading', 'Fullscreen Settings', obs.OBS_TEXT_INFO)
    obs.obs_properties_add_int(
        # TODO: enumerate and select from available outputs, obs_enum_outputs()?
        props, "fullscreen_monitor", "Monitor", 0, 9, 1  # limit to 9 outputs for now
    )

    obs.obs_properties_add_text(props, 'windowed_heading', 'Windowed Settings', obs.OBS_TEXT_INFO)
    obs.obs_properties_add_int(
        # TODO: enumerate and select from available outputs, obs_enum_outputs()?
        props, "windowed_monitor", "Monitor", 0, 9, 1  # limit to 9 outputs for now
    )

    options_list = obs.obs_properties_add_list(
        props,
        "reference_corner",
        "Reference Corner",
        obs.OBS_COMBO_TYPE_LIST,
        obs.OBS_COMBO_FORMAT_STRING,
    )

    for option in ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right']:
        obs.obs_property_list_add_string(options_list, option, option)

    obs.obs_properties_add_int(props, "ref_x", "X", 0, 32000, 1)
    obs.obs_properties_add_int(props, "ref_y", "Y", 0, 32000, 1)
    obs.obs_properties_add_int(props, "width", "Width", 0, 32000, 1)
    obs.obs_properties_add_int(props, "height", "Height", 0, 32000, 1)

    obs.obs_properties_add_button(
        props, "another", "Open Windowed\nProjector (Preview)", open_windowed_button)
    return props
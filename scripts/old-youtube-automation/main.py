import os
import re
import sys
import logging
import webbrowser

from aiohttp import web

logging.basicConfig(
    format='%(asctime)s %(levelname)-8s %(message)s',
    level=logging.DEBUG,
    datefmt='%Y-%m-%d %H:%M:%S'
)

import time
from datetime import date, datetime

import aioconsole

from youtube_broadcast import create_broadcast

import asyncio
import simpleobsws


import mido
from pygame import mixer

from pythonosc import udp_client

from flask import Flask, render_template, request, redirect, url_for

loop = asyncio.get_event_loop()

TEMPLATES_AUTO_RELOAD = True
app = Flask(__name__)

logging.debug("MIDI input ports: %s", mido.get_input_names())
logging.debug("MIDI output ports: %s", mido.get_output_names())
logging.debug("MIDI input/output ports: %s", mido.get_ioport_names())

portname = "LPD8 0:LPD8 1"

def make_stream():
    loop = asyncio.get_event_loop()
    queue = asyncio.Queue()
    def callback(message):
        loop.call_soon_threadsafe(queue.put_nowait, message)
    async def stream():
        while True:
            yield await queue.get()
    return callback, stream()


cb1, CONTROLLER_PORT_INPUT = make_stream()
r = mido.open_input(name=next((value for value in mido.get_input_names() if 'LPD8' in value), None), callback=cb1)
CONTROLLER_PORT_OUTPUT = mido.open_output(next((value for value in mido.get_output_names() if 'LPD8' in value), None))


host = "127.0.0.1"
port = 4455
password = "john1234"

xairip = "192.168.0.50" #set the xairip here
xairport = 10024

mixer_volume = 0

mixer.pre_init(44100, -16, 2, 2048)
mixer.init()

# TODO: sync led status

scene_to_mixer_channels = {
    'predicator': {
        'on': ["01",],
        'off': [ "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "14", "15", "16",]
    },
    'predicator_spate': {
        'on': ["01",],
        'off': [ "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "14", "15", "16",]
    },
    'sala': {
        'on': [ "14", "15", ],
        'off': ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "16", ]
    },
    'sala_spate': {
        'on': [ "14", "15", ],
        'off': ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "16", ]
    },
    'tineri': {
        'on': ["02", "03", "04", "05", "06", "07", "08", "09", "10",],
        'off': ["01",  "11", "12", "14", "15", "16", ]
    },
    'tineri_spate': {
        'on': ["02", "03", "04", "05", "06", "07", "08", "09", "10",],
        'off': ["01",  "11", "12", "14", "15", "16", ]
    },
    'solo': {
        'on': [ "16",],
        'off': ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "14", "15",  ]
    },
    'solo_spate': {
        'on': [ "16",],
        'off': ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "14", "15",  ]
    },
    'rugaciune': {
        'on': [ "14", "15", ],
        'off': ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12",  "16", ]
    }
}

# Pentru botez
# scene_to_mixer_channels = {
#     'predicator': {
#         'on': ["01", "04", "14",],
#         'off': ["02", "03",  "05", "06", "07", "08", "09", "10", "11", "12", "13", ]
#     },
#     'sala': {
#         'on': [ "05", "06", "04", "14", ],
#         'off': ["01", "02", "03",   "08", "10,""07", "09", "11", "12", "13", ]
#     },
#     'sala_fara_mic': {
#         'on': [  ],
#         'off': []
#     },
#     'tineri_fara_mic': {
#         'on': [  ],
#         'off': []
#     },
#     'tineri': {
#         'on': ["05", "06", "04", "14",],
#         'off': ["01", "08", "11", "12", "13", "02", "03",  "07", "09", "10",  ]
#     },
#     'botez': {
#         'on': ["05", "06", "04", "14",],
#         'off': ["01", "08", "11", "12", "13", "02", "03", "07", "09", "10",   ]
#     },
#     'solo': {
#         'on': [  "04", "14",],
#         'off': ["01", "02", "03", "05", "06", "07", "08", "09", "10", "11", "12", "13", ]
#     },
#     'rugaciune': {
#         'on': [ "08"],
#         'off': ["01", "02", "03",  "05", "06","07", "09", "10", "11", "12", "13",]
#     }
# }

CHANGE_OBS_STREAMING_STATE_ACTION = "change-obs-streaming-state"
CHANGE_OBS_SCENE_ACTION = "change-obs-scene"
PLAY_MUSIC_ACTION = "play-music"
STOP_MUSIC_ACTION = "stop-music"
SET_MUSIC_VOLUME_ACTION = "set-music-volume"
SELECTED_SCENE=''

midi_input_note_to_actions = {
    'note_on_36': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'rugaciune',
        },
    ],
    # 'note_on_37': [
    #     {
    #         'type': CHANGE_OBS_SCENE_ACTION,
    #         'value': 'sala',
    #     },
    # ],
    'note_on_37': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'predicator_spate',
        },
    ],
    'control_change_6': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'predicator_spate',
        },
    ],
    'note_on_38': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'sala_spate',
        },
    ],
    'control_change_8': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'sala_spate',
        },
    ],
    'note_on_39': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'solo',
        },
    ],
    'control_change_4': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'solo_spate',
        },
    ],
    'note_on_40': [
        {
            # Start/stop streaming
            'type': CHANGE_OBS_STREAMING_STATE_ACTION
        },
    ],
    'note_on_41': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'predicator',
        }
    ],
    'note_on_42': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'sala'
        }
    ],
    'note_on_43': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'tineri'
        }
    ],
    'control_change_9': [
        {
            'type': CHANGE_OBS_SCENE_ACTION,
            'value': 'tineri_spate'
        }
    ],
    'control_change_5': [
        # {
        #     'type': PLAY_MUSIC_ACTION,
        #     'file': './songs/song1.ogg'
        # }
    ],
    'control_change_1': [
        # {
        #     'type': SET_MUSIC_VOLUME_ACTION,
        # }
    ],
}

OBS_IS_STREAMING = False

parameters = simpleobsws.IdentificationParameters() # Create an IdentificationParameters object
# parameters.eventSubscriptions = (1 << 0) | (1 << 2) # Subscribe to the General and Scenes categories

OBS_WS = simpleobsws.WebSocketClient(url=f'ws://{host}:{port}', password=password,
                                     identification_parameters=parameters)

DEFAULT_OBS_STREAMING_OUTPUT = 'simple_stream'


def process_new_obs_scene(name):
    global CONTROLLER_PORT_OUTPUT
    logging.debug("process_new_obs_scene: %s", name)
    mapping = scene_to_mixer_channels.get(name)
    if mapping:
        for on_channel in mapping['on']:
            logging.debug("Setting channel {} as on".format(on_channel))
            client.send_message("/ch/" + str(on_channel) + "/mix/on", 1)

        for off_channel in mapping['off']:
            logging.debug("Setting channel {} on mute.".format(off_channel))
            client.send_message("/ch/" + str(off_channel) + "/mix/on", 0)

    for key, action_mappings in midi_input_note_to_actions.items():
        for ac in action_mappings:
            if ac['type'] == CHANGE_OBS_SCENE_ACTION:
                port_id = int(re.search('_(?P<port_id>[0-9]+)$', key, re.IGNORECASE).group('port_id'))
                set_input_state(port_id, name == ac['value'])

    refresh_led_input_state()
    SELECTED_SCENE = name


async def on_new_scene(eventData):
    new_scene = eventData['sceneName']
    logging.debug(u"New scene received: {}".format(new_scene))
    process_new_obs_scene(new_scene)
    refresh_led_input_state()


def on_stream_started():
    global CONTROLLER_PORT_OUTPUT, OBS_IS_STREAMING
    OBS_IS_STREAMING = True
    set_input_state(40, OBS_IS_STREAMING)

    refresh_led_input_state()


def on_stream_stopped():
    global CONTROLLER_PORT_OUTPUT, OBS_IS_STREAMING
    OBS_IS_STREAMING = False
    set_input_state(40, OBS_IS_STREAMING)

    refresh_led_input_state()


async def on_stream_state_changed(eventData):
    if eventData['outputState'] == 'OBS_WEBSOCKET_OUTPUT_STARTED':
        on_stream_started()
    if eventData['outputState'] == 'OBS_WEBSOCKET_OUTPUT_STOPPED':
        on_stream_stopped()
    refresh_led_input_state()


async def sync_obs_scene_with_mixer():
    current_scene = (await OBS_WS.call(simpleobsws.Request('GetSceneList'))).responseData['currentProgramSceneName']
    process_new_obs_scene(current_scene)


async def sync_obs_streaming_with_controller():
    global OBS_WS, CONTROLLER_PORT_OUTPUT, OBS_IS_STREAMING
    OBS_IS_STREAMING = (await OBS_WS.call(simpleobsws.Request('GetStreamStatus'))).responseData['outputActive']
    set_input_state(40, OBS_IS_STREAMING)

    refresh_led_input_state()


def extract_actions_from_midi_input(message):
    input_raw_name = ""
    if hasattr(message, 'note'):
        input_raw_name = "{}_{}".format(message.type, message.note)
    if hasattr(message, 'control'):
        input_raw_name = "{}_{}".format(message.type, message.control)
    logging.debug("extract_actions_from_midi_input: %s", input_raw_name)
    return midi_input_note_to_actions.get(input_raw_name, [])


def generate_led_change_message(key, on):
    parser = mido.Parser()
    if on:
        parser.feed([0x90, key, 0x01])
        return parser.get_message()
    else:
        parser.feed([0x90, key, 0x00])
        return parser.get_message()

midi_input_leds_state = {
}


def set_input_state(id, state):
    midi_input_leds_state[id] = state


def refresh_led_input_state():
    global CONTROLLER_PORT_OUTPUT
    if CONTROLLER_PORT_OUTPUT is None:
        logging.debug("refresh_led_input_state failed, CONTROLLER_PORT_OUTPUT is None")
        return

    logging.debug(f"refresh_led_input_state: {midi_input_leds_state}" )
    for key, value in midi_input_leds_state.items():
        CONTROLLER_PORT_OUTPUT.send(generate_led_change_message(key, value))


def build_message():
    current_date = date.today().strftime("%d.%m.%Y")
    current_time = datetime.now().strftime("%H:%M:%S")
    time_reper_duminica = "12:00:00"
    current_date_name = datetime.today().strftime("%A")

    mesaj = None

    if current_date_name == "Monday":
        mesaj = "Luni"
    elif current_date_name == "Tuesday":
        mesaj = "Marti"
    elif current_date_name == "Wednesday":
        mesaj = "Miercuri"
    elif current_date_name == "Friday":
        mesaj = "Vineri"
    elif current_date_name == "Saturday":
        mesaj = "Sambata"
    elif current_date_name == "Sunday":
        if (current_time < time_reper_duminica):
            mesaj = "Duminica dimineata"
        else:
            mesaj = "Duminica seara"
    elif current_date_name == "Thursday":
        mesaj = "Joi"

    mesaj = mesaj + " " + current_date + " "

    return mesaj


async def process_midi_actions(actions, message_control, message_value):
    if not actions:
        return

    logging.debug("process_midi_actions: %s %s %s", actions, message_control, message_value)

    global OBS_WS, CONTROLLER_PORT_OUTPUT, mixer_volume
    for action in actions:
        try:
            if action["type"] == CHANGE_OBS_SCENE_ACTION:
                await OBS_WS.call(simpleobsws.Request('SetCurrentProgramScene', {'sceneName': action["value"]}))
                process_new_obs_scene(action["value"])
            if action["type"] == PLAY_MUSIC_ACTION:
                mixer.music.load(action['file'])
                mixer.music.set_volume(mixer_volume)
                mixer.music.play(-1)
                for key, action_mappings in midi_input_note_to_actions.items():
                    for ac in action_mappings:
                        if ac['type'] == PLAY_MUSIC_ACTION:
                            port_id = int(re.search('_(?P<port_id>[0-9]+)$', key, re.IGNORECASE).group('port_id'))
                            set_input_state(port_id, False)
                set_input_state(message_control, True)

            if action["type"] == SET_MUSIC_VOLUME_ACTION:
                mixer_volume = message_value/127
                mixer.music.set_volume(mixer_volume)
            if action["type"] == STOP_MUSIC_ACTION:
                mixer.music.stop()
            if action["type"] == CHANGE_OBS_STREAMING_STATE_ACTION:
                if OBS_IS_STREAMING:
                    await OBS_WS.call(simpleobsws.Request('StopStream'))
                else:
                    await OBS_WS.call(simpleobsws.Request('SetCurrentProgramScene', {'sceneName': 'incepem in curand'}))
                    process_new_obs_scene('sala')
                    broadcastLink =  create_broadcast()
                    await OBS_WS.call(simpleobsws.Request('StartStream'))
                    message = f"""{build_message()}
{broadcastLink}"""
                    webbrowser.open_new_tab(broadcastLink)
                    time.sleep(1)

                    # layout = [[sg.Text('Posteaza pe WhatsApp.')],
                    #           [sg.InputText(default_text=message)],
                    #           ]
                    #
                    # window = sg.Window('Link WhatsApp', layout, keep_on_top=True)
                    # event, values = window.read()
                    # window.close()
                    absolute_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "whatsapp_message.txt"))
                    with open(absolute_path, "w") as file:
                        file.write(message)
                    os.system(f"notepad.exe {absolute_path}")


        except Exception as e:
            logging.debug("Cannot execute action, exception: %s", e)
            raise e

    refresh_led_input_state()


async def listen_for_midi_inputs():
    global CONTROLLER_PORT_INPUT
    # done = False
    # while not done:
    #     try:
    #         logging.debug("Connecting to Mixer...")
    #         with mido.open_ioport(portname) as port:
    #                 CONTROLLER_PORT_INPUT = input_port_midi
    #                 logging.debug("Connected to Mixer")
    #                 done = True
    #     except KeyboardInterrupt:
    #         sys.exit()
    #         pass
    #     except Exception as e:
    #         logging.debug(e)
    #         time.sleep(3)

    logging.debug('Using {}'.format(CONTROLLER_PORT_INPUT))
    logging.debug('Waiting for messages...')
    refresh_led_input_state()
    async for message in CONTROLLER_PORT_INPUT:
        logging.debug("midi message: %s", message)
        actions = extract_actions_from_midi_input(message)
        logging.debug('Received {} with actions: {}'.format(message, actions))
        await process_midi_actions(actions, hasattr(message, 'control') and message.control, message.value if hasattr(message, 'control')  else 0)
        refresh_led_input_state()
        sys.stdout.flush()
        # await asyncio.sleep(1)


async def on_event(eventType, eventData):
    logging.debug('New event! Type: {} | Raw Data: {}'.format(eventType, eventData)) # Print the event data. Note that `update-type` is also provided in the data


async def init():
    global ws, client, OBS_WS
    OBS_WS.register_event_callback(on_stream_state_changed, 'StreamStateChanged')
    OBS_WS.register_event_callback(on_new_scene, 'CurrentProgramSceneChanged')

    done = False
    while not done:
        try:
            logging.debug("Connecting to OBS...")
            await OBS_WS.connect()
            logging.debug("Connect")
            await OBS_WS.wait_until_identified()
            logging.debug("Connected to OBS")
            done = True
        except KeyboardInterrupt:
            sys.exit()
            pass
        except Exception as e:
            logging.debug("OBS error:")
            logging.debug(e)
            time.sleep(3)

    client = udp_client.SimpleUDPClient(xairip, xairport)
    await sync_obs_scene_with_mixer()
    await sync_obs_streaming_with_controller()
    # webbrowser.register('firefox',
    #     None,
    #     webbrowser.BackgroundBrowser("C://Program Files//Mozilla Firefox//firefox.exe"))
    # c = webbrowser.get('firefox')
    # c.open_new_tab('https://www.youtube.com/tv')


@app.route("/")
def index():
    return redirect("/obs")

@app.route("/obs")
def obs():
    # return render_template('obs.html')
    return redirect("http://obs-web.niek.tv/#ws://localhost:4455#john1234")

@app.route("/advanced")
def advanced():
    return render_template('advanced.html', midi_input_note_to_actions=midi_input_note_to_actions)


@app.get("/command")
async def command():
    global OBS_WS
    input_raw_name = request.args.get('c')
    actions = midi_input_note_to_actions.get(input_raw_name, [])
    logging.debug('Received via /command {} with actions: {}'.format(input_raw_name, actions))

    await process_midi_actions(actions,False, None)
    return redirect(url_for('index'))


async def flask_server():
    app.run(host='0.0.0.0', debug=False, port=8080, threaded=False)


async def keyboard_commands():
    logging.debug("Waiting for keyboard commands..")
    stdin, stdout = await aioconsole.get_standard_streams()
    async for line in stdin:
        input_raw_name = line.strip().decode("utf8")
        actions = midi_input_note_to_actions.get(input_raw_name, [])
        logging.debug('Received via keyboard {} with actions: {}'.format(input_raw_name, actions))
        await process_midi_actions(actions, False, None)
        await asyncio.sleep(1)

async def handle_websocket(websocket, path):
    while True:
        await websocket.send(SELECTED_SCENE)
        await asyncio.sleep(1)  # Adjust the interval as needed


if __name__ == '__main__':
    loop.run_until_complete(init())

    OBS_WS.register_event_callback(on_stream_state_changed, 'StreamStateChanged')
    OBS_WS.register_event_callback(on_new_scene, 'CurrentProgramSceneChanged')

    loop.create_task(listen_for_midi_inputs())
    # loop.create_task(flask_server())
    loop.create_task(keyboard_commands())

    # loop.run_until_complete(websockets.serve(handle_websocket, "localhost", 8765))   # Change the host and port as needed

    # app.run(host='0.0.0.0', port=8080, debug=False, threaded=False)
    loop.run_forever()

# TODO: update status on stream stop
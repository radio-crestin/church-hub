#!/usr/bin/python
import json
import os
import os.path
import datetime
import httplib2
from apiclient.discovery import build
from apiclient.errors import HttpError
from oauth2client.client import flow_from_clientsecrets
from oauth2client.file import Storage
from oauth2client.tools import run_flow

# INSERT FULL PATH
CLIENT_SECRETS_FILE = os.path.join(
    os.path.dirname(__file__),
    "secrets/client_secrets.json",
)

# This OAuth 2.0 access scope allows for full read/write access to the
# authenticated user's account.
YOUTUBE_READ_WRITE_SCOPE = "https://www.googleapis.com/auth/youtube"
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

# This variable defines a message to display if the CLIENT_SECRETS_FILE is
# missing.
MISSING_CLIENT_SECRETS_MESSAGE = """
WARNING: Please configure OAuth 2.0
To make this sample run you will need to populate the client_secrets.json file
found at:
   %s
with information from the {{ Cloud Console }}
{{ https://cloud.google.com/console }}
For more information about the client_secrets.json file format, please visit:
https://developers.google.com/api-client-library/python/guide/aaa_client_secrets
""" % os.path.abspath(os.path.join(os.path.dirname(__file__),
                                   CLIENT_SECRETS_FILE))


def get_authenticated_service():
    flow = flow_from_clientsecrets(CLIENT_SECRETS_FILE,
                                   scope=YOUTUBE_READ_WRITE_SCOPE,
                                   message=MISSING_CLIENT_SECRETS_MESSAGE)

    storage = Storage(os.path.join(
        os.path.dirname(__file__),
        "secrets/youtube_oauth_channel.json",
    ))
    credentials = storage.get()

    if credentials is None or credentials.invalid:
        credentials = run_flow(flow, storage)

    return build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION,
                 http=credentials.authorize(httplib2.Http()))


# Create a liveBroadcast resource and set its title, scheduled start time,
# scheduled end time, and privacy status.
def add_to_playlist(youtube, broadcast_id):
    add_playlist_item = youtube.playlistItems().insert(
        part="snippet",
        body={
            "snippet": {
                "playlistId": "PLT0o16dku1NHDiS4rDXqwCgfMN1AQuCq2",
                "resourceId": {
                    "kind": "youtube#video",
                    "videoId": broadcast_id
                }
            }
        }
    )

    add_playlist_respone = add_playlist_item.execute()
    print("Video added to playlist.")
    # print(add_playlist_respone)


# List upcoming broadcasts, if any exists, delete it
def list_broadcasts(youtube):
    list_broadcasts_response = youtube.liveBroadcasts().list(
        part="snippet,contentDetails,status",
        broadcastStatus="active"
    ).execute()
    return list_broadcasts_response


def list_live_broadcasts(youtube):
    upcoming_broadcasts = youtube.liveBroadcasts().list(
        part="id,snippet",
        broadcastStatus="upcoming"
    ).execute().get("items", [])
    return upcoming_broadcasts


def filter_upcoming_broadcasts(broadcasts):
    current_time = datetime.datetime.now()
    return [broadcast for broadcast in broadcasts if datetime.datetime.fromisoformat(broadcast['snippet']['scheduledStartTime']) > current_time]


def delete_upcoming_broadcasts(youtube, broadcast_ids):
    for broadcast_id in broadcast_ids:
        try:
            youtube.liveBroadcasts().delete(id=broadcast_id).execute()
            print(f"Deleted broadcast: {broadcast_id}")
        except HttpError as e:
            print(f"Error deleting broadcast: {broadcast_id}\n{str(e)}")


def delete_all_upcoming_broadcasts(youtube):
    upcoming_broadcasts = list_live_broadcasts(youtube)
    upcoming_broadcast_ids = [broadcast['id'] for broadcast in upcoming_broadcasts]
    delete_upcoming_broadcasts(youtube, upcoming_broadcast_ids)
    print("All upcoming broadcast deleted")


def insert_broadcast(youtube, config):
    insert_broadcast_response = youtube.liveBroadcasts().insert(
        part="snippet,status, contentDetails",
        body=dict(
            snippet=dict(
                title=config["broadcast_title"],
                description=config["broadcast_description"],
                scheduledStartTime=config["start_time"]
            ),
            status=dict(
                privacyStatus=config["privacy_status"],
                selfDeclaredMadeForKids=False
            ),
            contentDetails=dict(
                enableAutoStart=True,
                enableAutoStop=True
            )
        )
    ).execute()

    print("Broadcast inserted.")
    return insert_broadcast_response["id"]


# Bind the broadcast to the video stream. By doing so, you link the video that
# you will transmit to YouTube to the broadcast that the video is for.
def bind_broadcast(youtube, broadcast_id, stream_id):
    bind_broadcast_response = youtube.liveBroadcasts().bind(
        part="id,contentDetails",
        id=broadcast_id,
        streamId=stream_id
    ).execute()

    # print(bind_broadcast_response)
    print("Broadcast binded.")
    return bind_broadcast_response


def list_streams(youtube):
    print('Live streams:')

    list_streams_request = youtube.liveStreams().list(
        part='id,snippet',
        mine=True,
        maxResults=50
    )

    while list_streams_request:
        list_streams_response = list_streams_request.execute()

        for stream in list_streams_response.get('items', []):
            print('%s (%s)' % (stream['snippet']['title'], stream['id']))


        list_streams_request = youtube.liveStreams().list_next(
            list_streams_request, list_streams_response)

def create_broadcast():
    config = {
        "start_time": datetime.datetime.utcnow().isoformat()
    }

    # INSERT FULL PATH
    with open(os.path.join(
            os.path.dirname(__file__),
            "secrets/youtube_config.json",
    )) as f:
        data = json.load(f)
        config.update(data)

    youtube = get_authenticated_service()
    try:
        delete_all_upcoming_broadcasts(youtube)

        active_broadcasts = youtube.liveBroadcasts().list(
            part="id,snippet",
            broadcastStatus="active"
        ).execute().get("items", [])
        if len(active_broadcasts) > 1:
            raise Exception("Too many open broadcasts..")
        if len(active_broadcasts) == 1:
            broadcast_id = active_broadcasts[0]['id']
        else:
            broadcast_id = insert_broadcast(youtube, config)
        stream_id = config["stream_key_id"]
        try:
            bind_broadcast(youtube, broadcast_id, stream_id)
        except Exception as e:
            print("Failing binding broadcast.")
            list_streams(youtube)
            raise e
        add_to_playlist(youtube, broadcast_id)
        broadcast_link = "https://youtu.be/{}".format(broadcast_id)
        print(broadcast_link)
        return broadcast_link
    except HttpError as e:
        print(e.resp.status, e.content)


if __name__ == '__main__':
    create_broadcast()
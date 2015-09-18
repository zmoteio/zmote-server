# zmote: WiFI Universal Remote

zmote is a simple wifi-to-IR bridge using the ESP8266 chip.


There are six different components to the zmote system:

   1. *zmote Widget:*  This is the physical zmote widget that has an ESP-01, IR LEDs and TSOP receiver.  It is powered by a standard USB charger.  Often we'll just refer to it as the widget. (See repository `zmote-firmware`)
   2. *zmote Client*: This is the user interface web app.  It can run on a browser or within an app container of some kind.  It may be served from the server or directly from the device. (See repository `zmote-frontend`)
   3.  *zmote Server*: This is the HTTP server that hosts the zmote website, remote codes (LIRC) database, user database (that associates user accounts to zmote devices).  Only zmote clients talk to the server directly. (See repository `zmote-server`)
   4. *zmote Broker*: This the MQTT broker that is the only interface between the widget and the cloud. Communication between the broker and the server is only via the database. The MQTT broker also has a built-in HTTP server used for hosting firmware binaries used in OTA and recovery (See repository `zmote-broker`)
   5. *zmote Database*: A MongoDB database that hold all information about clients and widgets associated with gadgets and remotes
   6. *IR Protocol Service*: The HTTP server that offers a REST API for encoding and decoding IR signals.  This is used by the frontend when learning new keys

## Database Schema

   * *Clients*: Clients entries are maintained in a single collection and mainly hold the client secret and date when last accessed.  Client entries expire after 90 days of inactivity
   * *Widgets*: The widgets collection holds the chipID and secret for each released widget. Additionally it holds the list of gadgets controlled by a widget (by reference). Additional information specific to the widget, such as mac id and software revision, are also stored. 
   * *Gadgets*: These are the devices controlled over IR by the widget.  Each gadget has a name ("Living Room TV", "Set Top Box" etc.) and point to a single entry into either the "Remotes" or "UserRemotes" collection.
   * *Remotes*: Database entry for a remote controller listing the brand,model,type and all available keys along with their codes.  This is stored in two different collections: "Remotes" and "UserRemotes".  "Remotes" are a curated list of known remote controllers (usually sourced from the LIRC DB) and cannot be modified except by administrators with direct access to the DB.  When a Client needs to make changes, it first forks a copy into (or creates a fresh entry in) the "UserRemotes" collection.  This "UserRemotes" collection may be modified by all Clients that have access to the parent Gadget and Widget

## Module Boundaries

The rest of this documentation focuses on the API at four major module boundaries.

   1. [Widget-Client REST API](#markdown-header-widget-client-rest-api)
      * IR read/write API: Allows client to read, write, list and save IR codes
      * Device Settings API: WiFi station and access point configuration, access to other settings
   2. [Server-Client REST API](#markdown-header-server-client-rest-api): Find widgets, list/modify remotes in LIRC database, link/unlink widgets with gadgets
   3. [IR Protocol Service REST API](#markdown-header-ir-protocol-service-rest-api): Decode / Encode IR signals across various formats
   4. [Widget-Broker MQTT API](#markdown-header-widget-broker-mqtt-api): Allows widget to advertise presence, listen for commands and log actions. 


##  Widget-Client REST API


### `GET /api/wifi/mac`

Returns a structure with STA and AP mac.  The STA mac needs to be prefixed to each subsequent API call.

### `GET /<sta_mac>/api/wifi/scan`

Re-scan available SSID.  Returns an array of access points

```
#!json

  [
    {
      "ssid":"ssid1", 
      "rssi":-89, 
      "authmode":"wpa2_psk",  
      "cached": false, 
      "connected": false
    },
    {
      "ssid":"ssid2", 
      "rssi":-91, 
      "authmode":"wep",  
      "cached": false, 
      "connected": false
    }
]
```

### `PUT /<sta_mac>/api/wifi/connect`

Connect to a particular SSID.  The postdata should specify ssid and password.

```
#!json
   {
      "ssid": "Neverland",
      "password": "MichealJacksonRules"
   }
```

### `PUT /<sta_mac>/api/ir/trigger`

Prepare to receive IR code.  Clear any old IR code received

### `GET /<sta_mac>/api/ir/read`

Get last received IR code.  Returns an array of ON/OFF times (in us) as shown below

```
#!json
   {
      "trigger": [
         9000, // ON time
         4500, // OFF time
         ...
       ]
   }
```

### `PUT /<sta_mac>/api/ir/write`

Transmit IR code.  See example format below

```
#!json
   {
      "period": 910222, // Modulation waveform half period (in us expressed in Q16 format)
      "n": 40,          // The number of codes from the seq[] array for the first transmission
      "repeat":[
         0,      // Repeat count.  Zero means no repeat codes are sent
         0,      // Repeat start (after sending 0-"n", switches to sending from this index
         40      // Repeat end (repeat code end before this index)
      ],
      "seq:[  // Array of on/off times expressed in periods of the modulation frequency
         96,32,16,32,16,16,16,16,16,32,32,16,16,16,16,16,
         16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,
         16,32,16,16,32,32,3037
       ]
   }
```

The API also accepts an *array* of commands like the one shown above. This is intended for sending multi-digit key-presses (such as those for changing channels).
 
### `GET /<sta_mac>/api/spi/00`

Read the configuration parameters from flash

### `PUT /<sta_mac>/api/spi/00`

Write the configuration parameters to flash

## Server-Client REST API

### `GET /client/register`

Issues a fresh id and secret.  Client is expected to store this localStorage and use it in all subsequent sessions.  Credentials expire after 90 days of inactivity.  Client is expected to track last use and request fresh credentials when logging in after a long time.

### `POST /client/auth`

Login using credentials.  Client `_id` and `secret` needs to be provided.  On successful authentication, server responds with the full Client record that includes the external IP (fields `extIP`) of the client as seen by the server.  The client should store this to check which widget is available to access locally and which ones need to be controlled via the server.
 
### `GET /widgets`

Get a list of widgets accessible to the client.  Client must be authenticated before this API can be invoked.


### `GET /remotes?query="keys words"[&type="<gadget_type>"]`

Get a list of matching remotes.  `query` parameter must be supplied and must be at least 2 characters in length.  Optional `type` parameter may also be provided to filter the results.

### `POST /widgets/<widget_id>/gadgets`

Create a new gadget and associate to the widget.  The post data should look like:

```
#!json
   {
      "name": "<gadget_name>",
      "remote": "<remote_id>"
   }
```
Client must be authenticated before this API can be invoked.

### `PUT /widgets/<widget_id>/gadgets/<gadget_id>`

Update a gadget.  Can be used to change name or associate with different remote.  Post data looks same as above.

Client must be authenticated before this API can be invoked.

### `GET /widgets/<widget_id>/gadgets/<gadget_id>`

List a gadget. Client must be authenticated before this API can be invoked.

### `DELETE /widgets/<widget_id>/gadgets/<gadget_id>`

Delete a gadget. If gadget uses a userRemote, that will be deleted as well.Client must be authenticated before this API can be invoked.


### `PUT /widgets/<widget_id>/gadgets/<gadget_id>/userremote`

Create a new userRemote entry and associate with said Gadget and Widget.  Post data should look like

```
#!json
   {
      "userremote": {/* complete record */}
   }
```

Client must be authenticated before this API can be invoked.

### `POST /widgets/<widget_id>/gadgets/<gadget_id>/userremote`

Modify/Update a userRemote (new keys changes to layouts etc.)

Post data will be same as above. Client must be authenticated before this API can be invoked.

### `GET /widgets/<widget_id>/api/...`
### `PUT /widgets/<widget_id>/api/...`

MQTT-over-REST API for controlling widget.  In cases where the widget is not on the same network as the client, an authenticated client may control a widget by using this API.  URLs, verbs and post data are same as those shown in [Widget-Client REST API](#markdown-header-widget-client-rest-api).  The URL is changed by prefixing `/widget/<widget_id>`.  The `<sta_mac>/` portion of the URL is optional.  For example:

```
PUT /<sta_mac>/api/ir/write
```

becomes:

```
PUT /widgets/<widget_id>/api/ir/write
```

The response may not be immediately available.  In such cases, the server replies with:

```
#!json
{
   "_id": "<command_id>",
   "pending": true,
}
```

The client can check for the response using

```
GET /widgets/<widget_id>/command/<command_id>
```

Once again, `{"pending":true}` will be returned until the reply has been received (over MQTT) from the widget.  When the actual reply is received, that will be returned instead.  Should the request timeout or should an erroneous reply be received, the record associated with the command will be deleted, and the client will get a `404 Not Found` response.



## IR Protocol Service REST API


#### `POST /irp/decode`
Tries to decode IR ON/OFF times (in us) to one of known IR Protocol.

POST data is same as the one received from `GET /<sta_mac>/api/ir/read` API.

Response would be `{"error":"not found"}` on failure, IR specification (as below) on success:
````json
{"protocol":"RC5","device":3,"function":5,"misc":"no repeat: T=0"}
````

Presence of `T=0` or `T=1` in `misc` indicates that the protocol uses toggle bit (and its value for the data just decoded).


#### `POST /irp/encode`
Tries to encode given IR specification to Transmit IR code as required by `PUT /<sta_mac>/api/ir/write` API.

POST data is IR specification, matching with the one obtained from `POST /irp/decode` API.

Response would be `{"error":"unknown protocol"}` on failure, Transmit IR code as required by `PUT /<sta_mac>/api/ir/write` API on success.



## Widget-Broker MQTT API


### Topics

   1. Updates *from Widgets* appear on: `zmote/widget/<chipID>`
   2. Messages *to Widgets* are transmitted on: `zmote/towidget/<chipID>`

### Authentication

   1. Widgets authenticate using `username="mongoDB _id for widget entry"` `password="secret field in mongoDB widget entry"`
   2. Admins needs to use one time username and password generated on startup and stored in `.admin_auth` under the same directory (i.e., the `zmote-broker` directory on GCE VM)

### Messages

   1. Widget Hello: Sent by widget when connected `{"ip": "<ip_address>"}`
   2. Widget Disconnect: Widget's LWT  `{"disconnected": true}`
   3. Widget Goodbye: Sent by widget before entering OTA `{"goodbye": true}`
   4. Widget Keypress: Sent by widget when untriggered keypress is detected (Sent only if config parameter `"log" >= "1"`) The message is the same as the one described in `GET /<sta_mac>/api/ir/read`
  5. Widget Keylog: Sent by widget after successfully sending a sequence (Sent only if config parameter `"log" >= "2"`).  The message is the same as the command received (See `PUT /<sta_mac>/api/ir/write` command)
  6. ToWidget REST Adaptor: General mechanism to remotely use [Widget-Client REST API](#markdown-header-widget-client-rest-api) `{ "command":"VERB", "url":"/api/..", "postdata":"<postdata>", "id": "<command_id>" }`
  7. Widget REST Response: `{"id":<command_id>, "response":"<response_string>"}`
  8. ToWidget Update: Start OTA `{ "command":"OTA", "ip": "<ip_address>", "port": "<port_no>", "rom0": "/path/to/rom0.bin", "rom1": "/path/to/rom1.bin"}`

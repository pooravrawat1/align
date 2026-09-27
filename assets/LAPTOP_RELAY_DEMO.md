# Catalyst: cable-free two-headset demo with a laptop relay

## The short version

Both Quest headsets run the app themselves. The laptop does **not** stream VR graphics; it runs a small room-and-matching service. A private Wi-Fi network carries the room updates instead of USB cables. The laptop stays on a table while both participants move within the cleared demo area and wireless coverage.

This is the most practical next step because the current project already supports a laptop relay over Wi-Fi. We need to configure and install the wireless build, then verify the actual network with both headsets unplugged.

Current deployment status (2026-09-27): the wireless APK is **installed and running on both headsets**, using `http://172.20.10.8:4323`. Both apps joined room `DEMO` as Alex/Maya, and each had an established Wi-Fi connection to the relay with **no USB reverse mappings**. The USB forwarding watcher is stopped. All 27 matcher/relay tests passed before deployment. The laptop relay and its stay-awake helper are running. Both clients initially reported calibration pending; participants must press A/X once each. Physical cable removal and the walking/match demonstration still need participant confirmation. The known-working USB APK is preserved at `unity/Builds/Quest/Align-usb-fallback.apk`.

The repository is named `catalyst`. Some internal names remain `Align`: the Unity menus, APK filename, and Android package. The headset app may therefore appear as **Align** rather than Catalyst.

## 1. What I need from you

- Two charged Quest 2 headsets, with their controllers awake and working.
- The Mac with this repository, connected to power and kept awake with its lid open.
- A private hotspot or router that the Mac and both headsets can join. It must allow connected devices to reach one another; being on the same network name alone is not enough.
- Two USB data cables for the one-time update and any diagnostics. They are not needed during a successful wireless demo.
- USB debugging authorized on both headsets. If prompted, allow this computer in each headset.
- A cleared, well-lit demo area with passthrough and the headset safety boundaries enabled, plus one shared floor marker and a direction arrow.
- Two participants and preferably one operator watching the laptop and the physical space.

The immediate action is to connect the **Mac to the same hotspot as both headsets**, leave USB connected for installation, and tell me when it is ready. Enter the Wi-Fi password on the devices yourself; there is no need to put it in chat or the repository.

At the last network check, the headsets were on a `172.20.10.x` hotspot while the Mac was on `10.90.31.156`. Those were different networks. These addresses are historical, not values to copy into a new build; we must check the Mac's address after it joins the hotspot.

### Software already used by this project

- Unity `6000.0.66f2` with Android Build Support, SDK, NDK, and OpenJDK.
- Node.js `20.6+` and npm for the relay.
- ADB from Unity's Android SDK for installation and logs.

For the recommended fixture demo, we do not need a Gemini API key, Photon account, cloud server, public domain, or web companion. Once the software is installed, the demo does not require internet access; it does require a working local Wi-Fi connection. A phone hotspot must remain on and allow local device communication.

## 2. How the system works

```text
Quest A: local VR app  <-- private Wi-Fi -->  Laptop: room DEMO + matcher
Quest B: local VR app  <-- private Wi-Fi -->  Laptop: same relay, port 4323
```

Each headset renders passthrough and its own glass card locally. It sends its device identifier, requested demo profile, calibration state, and tracked head pose to the laptop. The laptop assigns the demo roles, maintains the room, and sends back the other participant's state and the shared match result.

The relay endpoint is `http://<MAC_WIFI_IP>:4323`. Both headsets must use the **same Mac address**. Inside a headset, `127.0.0.1` means that headset, not the laptop; it only worked previously because USB forwarding bridged the connection.

The implementation attempts room updates roughly every 0.1 seconds when no request is already in flight. This is not a promised network frame rate. The relay removes members after more than five seconds without updates; the card can hide sooner if poses become stale or tracking is lost.

The laptop must remain awake with the relay process running. Unity itself does not need to stay open after installation. Closing the relay terminal, losing the network, changing the Mac's IP address, or letting the laptop sleep can interrupt the demo.

## 3. What I will do for the wireless setup

1. Confirm the Mac and both headsets are on the intended private network.
2. Start or verify the relay and check that each headset can reach it over Wi-Fi.
3. Build the app with `ALIGN_MATCHER_URL=http://<MAC_WIFI_IP>:4323`, preserving the current glass design and A/X controls.
4. Install the same APK on both headsets over USB.
5. Launch both apps and confirm they join the same room.
6. Unplug both USB cables and repeat the name, calibration, match, hide/show, and profile-switch checks.
7. Declare it ready only after the unplugged checks pass.

No new networking system is required for this path. If the hotspot blocks device-to-device traffic, we need a different private router/hotspot; rebuilding alone cannot remove that restriction.

## 4. Operator setup: before participants put on the headsets

### A. Connect and check the network

Connect the Mac and both headsets to the same private hotspot/router. Keep the hotspot near the demo area and powered. Avoid an isolated guest or venue Wi-Fi network.

On this Mac, Wi-Fi was using `en0`. Check its current IPv4 address:

```sh
ipconfig getifaddr en0
```

If there is no output, use the active Wi-Fi interface shown in the Mac's network settings instead. Record the actual address as `MAC_WIFI_IP`. Do not use the hotspot/router's gateway address in place of the Mac's address.

### B. Start the room relay

From a terminal on the Mac:

```sh
cd /Users/pooravrawat/Desktop/catalyst/matcher
npm run start:demo
```

Leave this terminal running. The expected startup line is:

```text
[matcher] listening on 0.0.0.0:4323 mode=fixture
```

If a relay is already running, check its health instead of launching a second copy. An `EADDRINUSE` message means something already owns port 4323; identify it before stopping anything.

In a separate terminal:

```sh
curl --fail --max-time 5 http://127.0.0.1:4323/health
```

Expect JSON containing `"status":"ok"` and `"mode":"fixture"`. This proves only that the Mac can reach its own service.

Next, open `http://<MAC_WIFI_IP>:4323/health` in the browser on **each headset**, substituting the actual Mac IP. Both should display the health JSON. This is the important Wi-Fi reachability check, independent of USB reverse mappings. Return from the browser to the app for the demo.

If either headset cannot reach that address, fix the network or allow the relay's incoming connection in the Mac firewall before building. Do not disable the firewall wholesale. Internet browsing working on a headset does not prove that local access to the Mac works.

### C. Keep the Mac awake

Keep it plugged in, with the lid open, and leave the relay terminal running. Optionally run this in another terminal for the demo session:

```sh
caffeinate -i
```

Stop it with Ctrl+C when finished. This is not a substitute for leaving the lid open or keeping the hotspot powered.

### D. Build the wireless APK

This is a one-time step for the chosen relay address, not something participants do at every launch. If the Mac's IP changes later, the current app needs a rebuild and reinstall because the endpoint is baked into the scene. There is no in-headset server-address editor yet.

Save any work and close the Unity editor for this project before running the batch build. Preserve a separate copy of the known-working USB APK first if you want that fallback; this command overwrites `Builds/Quest/Align.apk`.

In a terminal, replace `ACTUAL_MAC_WIFI_IP` with the verified address:

```sh
cd /Users/pooravrawat/Desktop/catalyst
CATALYST_RELAY_IP="ACTUAL_MAC_WIFI_IP"
ALIGN_MATCHER_URL="http://${CATALYST_RELAY_IP}:4323" \
  "/Applications/Unity/Hub/Editor/6000.0.66f2/Unity.app/Contents/MacOS/Unity" \
  -batchmode -quit \
  -projectPath "/Users/pooravrawat/Desktop/catalyst/unity" \
  -executeMethod Align.Editor.QuestBuild.BuildApk \
  -logFile /private/tmp/catalyst-wireless-build.log
```

Confirm the build log reports success and the APK has a new timestamp before installing. The output remains `unity/Builds/Quest/Align.apk`. Setting the variable in a terminal does not change the environment of an already-running Unity editor; use the command above or launch Unity with the intended environment.

### E. Install on both headsets

Keep both USB cables connected for this step. In a terminal:

```sh
cd /Users/pooravrawat/Desktop/catalyst
CATALYST_ADB="/Applications/Unity/Hub/Editor/6000.0.66f2/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb"
"$CATALYST_ADB" devices
"$CATALYST_ADB" -s 1WMHH8117K0363 install -r unity/Builds/Quest/Align.apk
"$CATALYST_ADB" -s 1WMHHB65B82106 install -r unity/Builds/Quest/Align.apk
```

These are the two headsets used in the current setup. Check `adb devices` and substitute the serials if using different devices. Each must say `device`, not `unauthorized`, and both installs must report `Success`. Unity may restart ADB during a build; accept USB debugging again if asked.

Launch the app from the headset library, or run:

```sh
"$CATALYST_ADB" -s 1WMHH8117K0363 shell am start -W -n com.align.hackathon/com.unity3d.player.UnityPlayerGameActivity
"$CATALYST_ADB" -s 1WMHHB65B82106 shell am start -W -n com.align.hackathon/com.unity3d.player.UnityPlayerGameActivity
```

Wake the controllers if the operating system shows a controllers-required prompt. That prompt means the app may not have started yet, even if the install succeeded.

Wireless operation does not use `adb reverse` or `npm run relay:usb`. The USB watcher can be stopped with Ctrl+C in its terminal; do not stop the actual `npm run start:demo` relay. Old reverse mappings are not proof that Wi-Fi works. The acceptance test below requires physically unplugging both headsets.

## 5. What the participants see and do

### Starting a clean run

For predictable roles, fully close the app on both headsets and wait at least six seconds for old room membership to expire. Launch the intended **Alex headset first**, let it connect, then launch the **Maya headset**. Roles are assigned by room arrival, not permanently tied to a hardware serial.

Both clients automatically join room `DEMO`; there is no attendee login or room-code entry in this build. Keep both headsets worn and tracking during the run.

### A complete demonstration

1. **Show the name cards.** Once both headsets are connected and tracking, Alex sees Maya's name and Maya sees Alex's name. Each wearer sees the other person's card, not their own. The panel is rounded, pale translucent glass with black text, fixed about 1.35 m in front of its wearer. It can appear before calibration.
2. **Calibrate Alex.** Alex stands on the shared floor marker, faces the arrow, and presses A on the right controller or X on the left controller once. Alex then moves clear of the marker.
3. **Calibrate Maya.** Maya stands on the same marker, faces the same arrow, and presses A or X once. Do this sequentially, not with both people standing on the marker together. Calibration requires active head tracking.
4. **Reveal the match.** Once both calibration states reach the relay, the Alex/Maya fixture produces a compatible result. Both glass panels turn pale green and show the same conversation starter. The percentage score and full profile stay hidden. The old black diagnostic panel is not shown.
5. **Demonstrate cable-free movement.** With both USB cables unplugged, take a few slow steps inside the clear area. The card follows each wearer's view; it does not float over the other person's head. Stay within the safe physical boundaries and reliable Wi-Fi coverage.
6. **Hide and restore the card.** After calibration, press A or X again to hide the complete local card. Release and press again to show it. This does not disconnect either headset, reset calibration, or hide the other wearer's card.
7. **Show a nonmatch.** On the Maya headset, press B on the right controller or Y on the left controller once. Its demo profile changes to Sam. Alex now sees Sam; Sam still sees Alex. Both cards become neutral and the match reason disappears.
8. **Restore the match.** On that same second headset, press B or Y again to return to Maya. The green cards and the matching reason return after the updated result arrives.

There is no required walking distance or face-to-face gaze trigger for this version. Looking at someone or standing near them does **not** perform calibration. The panel represents the connected room peer, not a person identified in camera footage.

### Controls at a glance

| Control | Before successful calibration | After calibration |
| --- | --- | --- |
| A (right) or X (left) | Capture calibration while tracked | Toggle the complete card off/on locally |
| B (right) or Y (left), on Maya/Sam headset | Switch Maya/Sam once connected | Switch Maya/Sam and refresh the shared match |
| B or Y, on Alex headset | No profile switch | No profile switch |
| Left controller menu button, while delivered to the app | Reset the room | Reset the room and clear calibration on both clients |

Press and release between actions. After a room reset, both participants repeat the shared-marker calibration. Reset clears local card dismissal as well; it does not necessarily return Sam to Maya. If needed, switch the second headset back with B/Y. If the system captures the menu button instead of the app, close and relaunch both apps for a fresh local calibration session.

### Suggested spoken explanation

> Each headset runs Catalyst locally. A nearby laptop coordinates the room over private Wi-Fi, so both participants can move without cables. Their fictional demo profiles produce a shared compatibility cue and a conversation starter. This run uses deterministic, rubric-scored demo results, not a live AI request.

## 6. Cable-free acceptance checklist

Do not call the wireless setup ready until all of these pass:

- [ ] Each headset can load the Mac's Wi-Fi `/health` address.
- [ ] Both have the newly built wireless APK, not the old loopback/USB build.
- [ ] Both USB cables are physically unplugged.
- [ ] Both headsets remain connected and show the other person's name while worn and tracked.
- [ ] Both users calibrate and receive the green Alex/Maya result.
- [ ] A/X hides and restores the complete card on each headset independently.
- [ ] Maya → Sam → Maya produces green → neutral → green on both headsets.
- [ ] The sequence can be repeated three times without restarting the relay.
- [ ] Both users can move around the intended cleared area without persistent card loss or disconnection.
- [ ] The Mac and hotspot remain awake and powered throughout.

For later sessions on the same network and unchanged Mac IP, you normally only need to start the relay, wake the controllers, and open the installed apps. USB is needed again for updates or diagnostics, not for routine wireless play.

## 7. Troubleshooting

| Symptom | What to check or do |
| --- | --- |
| `Room relay unavailable`, timeout, or cannot connect to host in logs | Check the relay health on the Mac, then the Mac's Wi-Fi health address from each headset. Confirm all three use the same private network, the Mac IP matches the build, port 4323 is allowed, and the network does not isolate clients. |
| It works plugged in but fails immediately when unplugged | Suspect the old `127.0.0.1` USB build. Rebuild with the verified Mac Wi-Fi address and reinstall on both headsets. USB forwarding does not make a loopback build wireless. |
| Internet works but the Mac health page does not | Local traffic may be blocked, the address may be wrong, or the firewall may reject the relay. Use a private network that allows peer access; internet connectivity alone is insufficient. |
| `EADDRINUSE` on relay startup | Check the service already listening on 4323. Reuse a healthy fixture relay or stop its known terminal process before starting another. Do not kill unrelated processes. |
| `calibrated=false`, or neutral cards that never match | Both people must press A/X once while tracking. Vicinity does not calibrate. If unsure, reset the room and repeat the marker sequence on both headsets. |
| A/X hides the card instead of recalibrating | That headset is already calibrated. A/X is now the visibility toggle. Use a room reset before recalibrating. |
| No card, but the app is running | Check whether it was dismissed, whether the peer is connected and worn/tracking, and whether poses are fresh. Once calibrated, A/X can restore a dismissed card. Also check the relay if neither headset shows a card. |
| Green cue disappears after B/Y | The second headset may have switched to Sam, which intentionally does not match Alex. Press B/Y on that headset again to return to Maya. |
| Names are on the opposite headsets from the planned roles | The first active room member becomes Alex. Close both apps, wait at least six seconds, then launch the intended Alex headset first and Maya second. |
| Controllers-required prompt | Wake both controllers for that headset, then open the app. Installation success is different from launch success. |
| Cards disappear after setting a headset down | Loss of tracking or app suspension can hide the peer card. Put the headset back on and resume the app. Recalibrate if the app restarted. |
| Intermittent hiding while moving | Check hotspot coverage, tracking, headset sleep, and laptop sleep. The card intentionally hides when peer poses stop being fresh. |
| It stopped after changing hotspots or restarting the router | Recheck the Mac IP and local reachability. If the embedded address changed, rebuild and reinstall. |
| No black error/status box in the headset | Expected: that panel was deliberately removed. Read logs from the laptop when diagnosing. |

### Diagnostic commands

These do not establish wireless success on their own. Local smoke tests check the matcher, not headset networking:

```sh
cd /Users/pooravrawat/Desktop/catalyst/matcher
npm run smoke -- alex maya
npm run smoke -- alex sam
```

Expect `compatible: true` for Alex/Maya and `compatible: false` for Alex/Sam. In fixture mode, an API source label of `fallback` or `cache` is normal and is not a live-AI claim.

To inspect headset logs, reconnect one by USB and use its serial (requires the `CATALYST_ADB` variable from the installation section):

```sh
"$CATALYST_ADB" -s 1WMHH8117K0363 logcat -d -s Unity | rg '\[Align\]' | tail -30
```

Logs may include previous launches; check their timestamps. Do not assume that reconnecting USB has repaired Wi-Fi. After any correction, repeat the unplugged test.

### USB fallback

If the private Wi-Fi cannot be made reliable in time, reinstall the preserved USB build on both headsets, or rebuild explicitly with `ALIGN_MATCHER_URL=http://127.0.0.1:4323`. Keep the matcher running and use:

```sh
cd /Users/pooravrawat/Desktop/catalyst/matcher
npm run relay:usb -- 1WMHH8117K0363 1WMHHB65B82106
```

Both cables must stay connected for that fallback. Starting this watcher does not redirect a Wi-Fi-address build to USB. A cabled fallback should be demonstrated stationary with cables managed safely.

## 8. Limits, privacy, and accurate demo claims

- This is a two-headset demonstration, not a tested many-attendee deployment.
- The profiles are fictional Alex/Maya/Sam fixtures. There is no login, personal-profile editor, or web-to-headset profile transfer in this slice.
- The visible result is the other person's name and, when matched, a conversation starter. Full bios, social fields, and numeric scores are not shown in the current Quest card.
- The glass look is translucent rounded UI geometry, not a sampled blur of the passthrough camera image.
- The headsets share identifiers, profile selections, calibration state, and pose data with the laptop. The relay uses its bundled profile fixtures for this demo. This is not a claim that all session data stays on each headset.
- Fixture mode makes no Gemini requests. Do not present its result as a live AI assessment.
- This is the HTTP relay path, not Photon and not standalone headset-to-headset networking. Removing the laptop is a separate future change.
- No facial recognition or camera-frame analysis is used. People without a connected headset are not detected as attendees.
- Matching is not gated by real-world proximity or gaze in this build; names appear for a live peer, and calibration enables matching.
- The current relay is unauthenticated and uses plain HTTP. Use only fictional data on a trusted private demo network. Do not expose port 4323 to the public internet or add a public tunnel/port-forward.
- Cable-free does not mean unrestricted movement: stay in the cleared area, respect the headset boundaries, walk slowly, and have an operator watch for obstacles and collisions.

## 9. Related implementation and documentation

- [Project overview](../README.md)
- [Unity setup and controls](../unity/README.md)
- [Matcher and relay documentation](../matcher/README.md)
- [Room relay state and role assignment](../matcher/src/rooms.mjs)
- [Headset HTTP transport](../unity/Assets/Align/Runtime/Networking/HttpRoomTransport.cs)
- [Controller buttons and calibration flow](../unity/Assets/Align/Runtime/Integration/TwoHeadsetDemoController.cs)
- [Demo scene and relay-address selection](../unity/Assets/Align/Editor/QuestDemoSceneFactory.cs)

Next step for the current setup: unplug both USB cables, put on both headsets, calibrate each with A/X on the shared marker, and confirm the cards remain visible and turn green. Then test local hide/show and a short, safe walk. The Mac is on the hotspot at `172.20.10.8`; keep it awake with the relay running and on this network.

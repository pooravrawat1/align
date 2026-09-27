# Catalyst demo video — working cut

Planning assumption: a two-minute submission video. Confirm the actual time limit, judging criteria, and available headset footage before locking the edit. This is a filming plan, not a statement that the integrations below have been verified.

## The story

**The person who could help your idea might be standing right beside you. Catalyst gives you a reason to say hello.**

Follow Alex and Maya through one introduction. Alex builds wearable hardware; Maya builds computer vision. The payoff is a real conversation, followed by a specific next step. Give judges three things to remember: context in the room, an interface that steps back during conversation, and context that helps afterward.

The main visual reveal should be an actual headset capture wherever available. The landing-page goggles are useful for the title or closing shot, but are illustrative product imagery, not evidence of headset tracking.

## Two-minute storyboard and draft narration

| Time | Picture / action | Narration |
| --- | --- | --- |
| 0:00–0:08 | Real event-room footage. Alex and Maya are nearby but occupied separately. Brief room sound, then voice. | “The person who could help your idea might be standing right beside you. At an event, how would you know?” |
| 0:08–0:18 | Show the strongest headset moment early: name, then the green cue and short explanation. Brief Catalyst wordmark. | “Catalyst brings a reason to meet into the room—a shared interest, complementary expertise, or an experience you have in common.” |
| 0:18–0:31 | Short crops of prepared profile inputs. Alex: wearable hardware, seeking computer vision. Maya: computer vision, seeking hardware. Avoid filling out the whole form. | “Meet Alex. He builds wearable hardware. Maya builds computer vision. They both care about assistive technology. Their skills could help each other.” |
| 0:31–0:54 | Actual Quest view, or clearly labeled staged/browser preview. Show neutral discovery, then the match. Hold the reason long enough to read. If two-device synchronization is verified, include both wearer views with a short external shot. | “With participating attendees in the same room, Catalyst surfaces a short, specific introduction: Alex builds wearable hardware. Maya builds computer vision. They could turn visual assistance into a working wearable together.” |
| 0:54–1:08 | Explicit Start conversation action. Show the explanation collapsing, then cut to the two people talking. | “The cue starts the conversation. Then the interface steps back, leaving the attention on the person in front of you.” |
| 1:08–1:31 | Clear chapter transition: ‘Companion demo · After the event.’ Open Alex’s prepared recap, choose Maya, show the meeting note and editable follow-up. | “The companion demo shows what happens afterward. Revisit Maya, keep the idea you discussed, and turn your note into a specific follow-up: send the wearable prototype and plan a test together.” |
| 1:31–1:49 | Simple three-part technical visual over real evidence: participating headsets → shared room and match result → name and reason. Cut briefly to code or debug evidence only if it reads clearly. | “The prototype combines a Unity headset interface, a profile-matching service, and a web companion. Matching uses information people provide. The headset presents a name and a reason to meet, without displaying a compatibility score.” |
| 1:49–2:00 | Return to the real conversation, then a restrained Catalyst end card. | “A name is a start. A reason to talk is a catalyst. Your people. In plain sight.” |

Treat these times as edit slots; rehearse narration aloud and leave room for readable actions rather than filling every second with speech.

## The moments worth protecting

1. **The first reveal:** let a neutral name acquire meaningful context. The content of the reason matters more than an animation.
2. **The interface stepping back:** explicitly demonstrate conversation mode. This makes the product about meeting people rather than collecting profile cards.
3. **The specific follow-up:** show the same Alex/Maya pairing and the wearable-prototype note. Continuity makes the companion useful and understandable.

If footage supports it, show a neutral nonmatch very briefly to explain that green is selective. Do not spend the main cut explaining the Sam fixture switch or percentages.

## Capture list

- A wide shot of the room, without relying on identifiable bystanders as product participants.
- Alex and Maya wearing the actual demo headsets, plus a natural conversation shot.
- Clean headset capture of neutral → match → explicit conversation → discovery.
- Both wearer views of the same match if real synchronization is working.
- Two short profile crops that establish the complementary skills.
- A browser capture of the prepared Alex recap: `#/recap-demo?persona=alex`, Maya selected, note visible, follow-up opened.
- Optional matching-service evidence with source mode visible and no secrets on screen.
- A clean logo/end card. Use the current Catalyst wordmark, neutral type, and jade only for the core cue.

Capture each interaction separately with a few seconds of stillness before and after. Record voiceover separately in a quiet room. Use one consistent screen size, readable crops, captions, restrained cuts, and music kept below speech. Avoid decorative transitions across every click.

## Recording order

1. Establish the footage boundary with the headset teammate: staged one-device preview or demonstrated synchronized two-device behavior.
2. Record the headset reveal first. It is the most distinctive and least replaceable footage.
3. Record the Alex/Maya browser story using the prepared demo. Keep persona and event consistent across clips.
4. Capture the external room/conversation footage.
5. Assemble a rough cut before polishing. Verify that a viewer can explain the product after the first 30 seconds.
6. Record final narration to the rough cut, then add captions, sound, and the end card.
7. Review once with audio and once muted. Check every caption for whether it describes the footage actually shown.

## Claims and footage boundaries

- Two-headset pose synchronization and shared-origin calibration need actual two-device evidence before being narrated as demonstrated behavior. Current repository handoffs distinguish this from the staged controller.
- A staged headset cue remains labeled as a staged prototype. A browser room remains labeled as a browser preview. Do not composite a tracking label onto real footage and present it as captured functionality.
- The headset implementation uses connected participant identity and headset pose, not facial recognition. It cannot identify arbitrary people walking through the room.
- The web companion and Quest demo do not currently document profile/connection synchronization. Use a visible chapter transition into the prepared companion example; do not edit a headset action directly into a website update as if it synced.
- Prepared matching and prepared follow-up text are not live Gemini output. Use “AI-generated” for a captured result only when that result was actually generated in the demonstrated mode.
- Prepared recap durations and notes are authored example data, not automatically measured conversations or transcripts. Keep automatic timing/recording claims out of the video.
- Saving a profile is private; Connect sends a request. A sent request is not an accepted connection. Show the correct state or use the explicitly prepared connected example.
- The companion is a prototype with temporary sessions, not production authentication and durable cross-device accounts.

## If headset integration is incomplete

Keep the same story, but introduce the spatial footage as: “Here is the headset interaction prototype.” Show what is working cleanly, then identify the companion as a separate demo. Mention the integration boundary once in the technical beat. A coherent, honest prototype is more persuasive than a seamless edit that implies unbuilt behavior.

## Sixty-second backup

- 0:00–0:07: problem and person in the room.
- 0:07–0:15: Alex/Maya context.
- 0:15–0:35: headset reveal and conversation mode.
- 0:35–0:50: prepared companion note and follow-up.
- 0:50–1:00: one implementation sentence and Catalyst close.

## Leave out of the main video

Full onboarding, exhaustive navigation, settings, every network view, long landing-page scrolling, percentage/rubric explanations, install/calibration waiting time, generic AI claims, and an extended team introduction. Keep team credits brief if required by the submission rules.

## Decisions still needed

- Exact video duration and submission format.
- Judging criteria / prize tracks.
- Actual one- or two-headset capture readiness.
- Whether the recorded matcher and follow-up runs use live generation or prepared results.
- Who will voice the video and who can appear in the room shots.

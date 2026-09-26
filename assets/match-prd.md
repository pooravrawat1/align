# PRD: Align

**Version:** 1.0  
**Status:** Hackathon MVP  
**Platform:** Meta Quest 2  
**Target build time:** 24–36 hours

> **Current two-Quest demo override (September 26, 2026):** This document
> includes the original, broader product concept. For the build now underway,
> headset A uses bundled Alex, headset B uses bundled Maya with an operator-only
> Sam nonmatch switch. The headset shows only a floating name, then an identical
> green cue and conversation starter for a match. There is no custom headset
> profile form, expanded card, visible score, login, or web-to-Quest sync.
> Person 3's current source of truth is the
> [matching rubric](align-matching-rubric.md),
> [demo fixture](quest-demo-fixtures.json), and
> [matcher contract](../matcher/README.md). These supersede conflicting
> requirements and examples below; the web companion remains unchanged.

## 1. Product summary

Align is a colocated mixed-reality networking experience for events. Attendees wearing Meta Quest 2 headsets can see lightweight profile cards floating above other participants' heads.

An AI matching system compares participant profiles in the background. When two people are considered compatible, their profile cards turn green and display a specific reason they should meet.

## 2. Problem

At hackathons, conferences, and networking events, attendees frequently walk past people who share their interests or could help with their projects. Existing networking applications require users to browse directories or continually check their phones.

Align makes relevant connections visible directly in the physical environment.

## 3. Goals

The MVP must:

- Allow two or more Quest 2 users to join the same event session.
- Let each user create, preview, edit, and save a session profile or load a demo default.
- Support optional user-provided social links or handles on the profile.
- Align users within one shared physical coordinate system.
- Display a profile card above each participant's physical head.
- Synchronize headset positions in real time.
- Use synchronized headset pose—not computer vision—to locate Quest 2 participants.
- Show cards only for connected, calibrated participants who are in range, in view, and transmitting a recent tracked pose.
- Compare participant profiles using an AI-backed matching system.
- Turn both participants' profile cards green when they match.
- Display a short explanation of why the participants should talk.
- Demonstrate the complete experience reliably to hackathon judges.

## 4. Non-goals

The hackathon MVP will not include:

- Facial recognition
- Raw passthrough-camera computer vision or person identification on Quest 2
- Support for people who are not wearing headsets
- Precise full-body tracking
- Production-grade authentication
- Large events with hundreds of simultaneous participants
- Advanced profile privacy settings
- A polished consumer interface
- Quest Store publication
- Mobile or web clients
- Persistent social graphs
- Long-term compatibility predictions

## 5. Target users

### Primary user

A hackathon or conference attendee who wants to discover relevant people nearby.

### Secondary user

An event organizer who wants to encourage useful conversations between participants.

### Demo user

A judge who needs to understand the product within one minute and see the complete interaction without complicated setup.

## 6. Core user journey

1. The user launches Align on a Quest 2.
2. The user enters an event room code.
3. The user enters or selects:
   - Name
   - Short bio
   - Interests
   - Skills
   - What they are looking for
   - Optional social links or handles
4. The user previews and saves the profile for the current session. Alex and Maya are available as editable demo defaults.
5. The user completes spatial calibration.
6. The user enters the shared passthrough experience.
7. The application receives calibrated headset poses from other connected participants.
8. The user sees cards above nearby participants who are in range and within their viewing direction.
9. The backend evaluates the profiles.
10. If two users are compatible:
   - Both profile cards turn green.
   - Both users see the match explanation.
   - An optional sound indicates that a match was found.
11. The users approach each other and begin a conversation.

## 7. User experience

### 7.1 Profile creation

The profile UI must allow a user to:

- Enter a name and short bio.
- Add interests, skills, and what they are looking for.
- Optionally add LinkedIn, GitHub, Instagram, and personal website links or handles.
- Preview how their information will appear to another participant.
- Edit and save the profile for the current session.
- Load Alex or Maya as an editable demo default.

Name is required. Other fields are optional but should be clearly labeled. The MVP stores profiles only for the current session and does not require an account.

### 7.2 Profile card

The default profile card displays:

- First name
- Role or one-line bio
- Up to three interest tags
- Compact social icons or handles in the nearby/expanded state when supplied

Example:

```text
MAYA

Robotics Engineer

Robotics · Computer Vision · Startups
```

### 7.3 Match state

When two users match, the profile card:

- Changes from white or gray to green.
- Displays a green halo or outline.
- Shows a short compatibility explanation.
- Optionally plays a notification sound.

Example:

```text
STRONG MATCH

You are both building assistive technology.

Maya needs embedded-systems help, and you have
experience deploying models on edge devices.
```

### 7.4 Nonmatch state

Nonmatching users remain neutral. The application will not display:

- Red profile cards
- Negative compatibility messages
- Public rejection indicators
- Sensitive or inferred personal attributes

### 7.5 Visibility behavior

To reduce visual clutter:

- Only connected headset users in the same room are eligible for a card.
- A card remains hidden until both users are calibrated and the remote pose is recent and tracked.
- Cards outside the configured distance range or viewing direction are hidden.
- Distant participants show only their name.
- Nearby participants show their name, bio, and tags.
- Match explanations appear only for compatible users.
- Profile cards always face the viewing user.
- Profile cards remain approximately 20–30 cm above the remote headset.

## 8. Functional requirements

### FR-1: Session creation and joining

- Users must be able to join the same session using a room code.
- The room must support at least two simultaneous Quest 2 devices.
- Each connected user must receive a unique session identifier.

### FR-2: Profile creation

- Users must be able to create and edit a profile containing a name, bio, interests, skills, goals, and optional social links or handles.
- The UI must provide profile preview, validation, and save-for-session behavior.
- Name is required; social links are optional and must be visibly identified as user-provided.
- Alex and Maya must remain available as one-click, editable demo defaults.
- The system must associate the profile with the user's session identifier.
- The same profile form should work with desktop input during development and the Quest system keyboard once hardware is available.

### FR-3: Spatial calibration

- Each headset must map its local tracking space to a shared physical origin.
- The MVP should use manual calibration for reliability.
- Users stand at the same marked position, face an indicated direction, and select **Calibrate**.
- The application must provide a recalibration control.

### FR-4: Position synchronization

- Each headset must transmit its head position and rotation.
- Each pose update must include tracking validity and a timestamp or network tick.
- Remote head transforms must update continuously.
- Movement should appear sufficiently smooth for a profile card to remain above the user.
- The system should interpolate network updates to reduce jitter.
- The system must stop rendering a participant when their pose becomes stale or invalid.

### FR-5: Profile rendering

- Render a world-space profile card for every remote participant.
- Make the card follow the remote headset's position.
- Make the card face the local viewer.
- Do not show the local user a duplicate card above their own head.
- Display supplied social handles or links only in the nearby/expanded profile state to avoid visual clutter.
- Position the card approximately 20–30 cm above the synchronized remote headset pose.
- Gate visibility using room membership, calibration state, pose freshness, distance, and the local view direction.
- Do not claim that Quest 2 has visually detected or identified the physical person.

### FR-6: Matching

- Compare the profiles of users in the same room.
- Return a compatibility result, score, and one-sentence explanation.
- Store pair results so the same pair is not repeatedly evaluated.
- Treat compatibility as symmetrical: if A matches B, B matches A.

### FR-7: Match visualization

- When a compatible result is received, both users see the other participant turn green.
- Both users see the same match explanation.
- The visual state remains synchronized across clients.

### FR-8: Demo controls

The application must include controls to:

- Recalibrate the shared origin
- Reconnect to the room
- Re-run matching
- Trigger a known successful demo match
- Reset the current session

## 9. Matching system

### 9.1 Profile input

```json
{
  "name": "Maya",
  "bio": "Robotics engineer building assistive devices",
  "interests": ["computer vision", "robotics", "startups"],
  "skills": ["Python", "machine learning", "CAD"],
  "lookingFor": ["embedded systems collaborator"],
  "socialLinks": [
    {"platform": "GitHub", "urlOrHandle": "maya-builds"},
    {"platform": "LinkedIn", "urlOrHandle": "maya-robotics"}
  ]
}
```

### 9.2 Matching output

```json
{
  "userA": "user-123",
  "userB": "user-456",
  "compatible": true,
  "score": 0.91,
  "reason": "You are both building assistive technology, and Maya needs the embedded-systems experience you can provide."
}
```

### 9.3 MVP matching approach

For two to four demo users:

1. Send both profiles to the backend.
2. Ask the model whether a useful conversation exists.
3. Require structured JSON output.
4. Mark the pair compatible when its score exceeds a configurable threshold.
5. Store the result using sorted user-pair identifiers.

### 9.4 AI requirements

The model must:

- Use only information explicitly present in the profiles.
- Exclude social links and handles from model input and matching decisions.
- Identify a concrete reason for the users to meet.
- Avoid inferring protected or sensitive attributes.
- Avoid romantic, medical, political, or employment judgments.
- Produce an explanation under 30 words.
- Return valid structured JSON.

### 9.5 Demo fallback

The application must include precomputed compatibility results. If the AI service is unavailable or slow, the frontend uses the precomputed result so the demonstration can continue.

## 10. Technical architecture

```text
┌───────────────────┐       ┌───────────────────┐
│      Quest A      │       │      Quest B      │
│                   │       │                   │
│ Passthrough       │       │ Passthrough       │
│ Head tracking     │       │ Head tracking     │
│ Profile cards     │       │ Profile cards     │
└─────────┬─────────┘       └─────────┬─────────┘
          │                           │
          └─────────────┬─────────────┘
                        │
               Multiplayer session
         Position, rotation, profile state
                        │
              ┌─────────▼─────────┐
              │      Backend      │
              │                   │
              │ Profiles          │
              │ Match results     │
              │ AI integration    │
              └─────────┬─────────┘
                        │
                   LLM provider
```

## 11. Proposed technology stack

### Quest application

- Unity
- C#
- Meta XR All-in-One SDK
- Meta Quest passthrough
- Meta XR Plugin or OpenXR
- TextMeshPro
- World-space Unity canvases

### Quest 2 participant-location strategy

Quest 2 passthrough is used only to show the physical environment. The MVP does not request or process raw passthrough-camera frames. Every spatial participant must wear a connected Quest 2 headset.

Each client reads its locally tracked XR head pose through an `IHeadPoseProvider`, converts that pose into the manually calibrated shared coordinate system, and transmits it through the multiplayer session. Remote cards are anchored above those synchronized poses.

Two pose-provider implementations are required:

- `SimulatedHeadPoseProvider` for keyboard-controlled editor and desktop testing without hardware.
- `QuestHeadPoseProvider` for the tracked Quest XR camera transform.

The rest of the application must not depend directly on either provider. This allows networking, calibration, matching, and card rendering to be completed before the devices arrive.

### Multiplayer

Preferred:

- Photon Fusion in Shared Mode

Alternative:

- Unity Netcode for GameObjects

### Backend

Choose one:

- Firebase Cloud Functions and Firestore
- Supabase with a lightweight server
- FastAPI or Express with a simple database

### AI

- LLM API with structured JSON output
- Precomputed results as an offline fallback

## 12. Coordinate alignment

### MVP approach: manual shared origin

A physical calibration marker is placed on the floor or a table.

Each participant:

1. Stands at the marker.
2. Faces the same printed arrow.
3. Selects **Calibrate**.
4. The application records the current headset position and yaw.
5. Subsequent tracking information is transmitted relative to this origin.

Pitch and roll should not define the shared forward direction. Only horizontal position and yaw are required.

### Stretch goal: Shared Spatial Anchors

If time permits, replace manual calibration with Meta Shared Spatial Anchors. Manual calibration must remain available as a fallback.

## 13. Performance requirements

- Target 72 frames per second on Quest 2.
- Support at least four visible participants.
- Keep perceived profile-card tracking latency below 250 ms.
- Send position updates approximately 10–20 times per second.
- Hide a remote card when pose updates exceed the configured stale-pose timeout.
- Complete matching within 10 seconds when possible.
- Keep the application usable while matching is pending.
- Use minimal scene geometry and lighting.

## 14. Privacy and safety requirements

- Display only user-entered profile information.
- Make social links optional, visibly user-provided, and editable before joining a room.
- Do not send social links or handles to the AI matching service.
- Do not perform facial recognition.
- Do not request or process raw Quest 2 passthrough images for person detection.
- Do not present pose-based placement as visual identification.
- Do not infer sensitive characteristics.
- Store profiles only for the current event or demonstration.
- Tell users that their profile is visible to other participants.
- Do not reveal private fields in match explanations.
- Keep physical obstacles visible through passthrough.
- Do not place profile cards in the user's walking path.
- Keep participants within a defined, obstacle-free demo area.

## 15. Success metrics

The hackathon MVP succeeds when:

- A user can create, preview, edit, and save a custom profile.
- A user can add optional social links and another participant can view them.
- Alex and Maya can be loaded as editable defaults for a fast demo.
- Two Quest 2 users can join the same room.
- Each user sees the other person through passthrough.
- A profile card remains visibly attached above the other headset.
- No card appears for a user who is disconnected, uncalibrated, out of range, outside the viewing direction, or no longer transmitting a valid pose.
- The card stays reasonably aligned while the person walks.
- The system produces a compatibility result.
- Both users see the green match state.
- Both users see the same match explanation.
- The full demonstration takes less than two minutes.
- The demonstration succeeds at least three consecutive times.

## 16. Hackathon implementation plan

### Phase 1: Single-device prototype

- Create the Unity Quest project.
- Enable passthrough.
- Render a test profile card in world space.
- Make the card face the user.

**Exit condition:** A profile card is visible and readable in passthrough.

### Phase 2: Multiplayer tracking

- Connect two Quest devices to one room.
- Synchronize head position and rotation.
- Represent each remote headset with a cube.
- Add interpolation.
- Include tracking validity and pose freshness.

**Exit condition:** Each participant sees a cube following the other participant's head.

### Phase 3: Spatial calibration

- Implement manual origin calibration.
- Convert local head poses into shared coordinates.
- Add a recalibration button.

**Exit condition:** The remote cube remains close to the physical headset.

### Phase 4: Profile creation

- Build the profile form, validation, preview, edit, and session save flow.
- Add optional LinkedIn, GitHub, Instagram, and personal website fields.
- Add Alex and Maya as editable defaults that populate the same form.

**Exit condition:** A custom profile can be created and previewed, and a demo default can be loaded in one action.

### Phase 5: Profile cards

- Replace cubes with profile cards.
- Add distance-based detail.
- Add viewer-facing behavior.
- Gate cards on connection, calibration, valid recent pose, distance, and view direction.

**Exit condition:** Each participant sees the correct profile above the correct person.

### Phase 6: Matching

- Create profile and match data models.
- Connect the backend and LLM.
- Cache pair results.
- Add precomputed fallback results.

**Exit condition:** The system returns a compatibility result and explanation.

### Phase 7: Match reveal

- Add the green state and animation.
- Synchronize match results between clients.
- Add optional audio feedback.

**Exit condition:** Both participants see each other turn green simultaneously.

### Phase 8: Demo hardening

- Add preset profiles.
- Add reconnect and reset controls.
- Test repeated demonstrations.
- Record a backup video.
- Prepare a one-minute pitch.

## 17. Suggested team allocation

### Developer 1: Quest and mixed reality

- Unity setup
- Passthrough
- Profile rendering
- Calibration
- Quest builds

### Developer 2: Multiplayer

- Session management
- Pose synchronization
- Interpolation
- Shared match state

### Developer 3: Backend and AI

- Profile API
- Match evaluation
- Structured output
- Caching and fallback

### Designer or presenter

- Profile creation, validation, preview, and edit flow
- Profile-card layout
- Match animation
- Preset profiles
- Pitch and demonstration flow

For a smaller team, combine the Quest and multiplayer roles first. Add the AI integration after the spatial experience works.

## 18. Major risks and mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Headsets use different coordinate systems | Critical | Implement manual calibration before advanced features |
| Multiplayer setup takes too long | High | Use a Photon sample and test with cubes first |
| Profile cards jitter | Medium | Interpolate remote transforms and reduce update noise |
| Stale tracking leaves a floating card | High | Timestamp poses and hide the card after a short configurable timeout |
| Quest 2 cannot provide raw passthrough frames for CV | Critical | Use connected headset poses; require every spatial participant to wear a headset |
| Alignment drifts | Medium | Keep the demo area small and provide one-click recalibration |
| AI response is slow | Medium | Start matching immediately and cache results |
| AI API fails | High | Include precomputed demo matches |
| Quest build process is slow | High | Test device builds early and avoid unnecessary packages |
| Text is difficult to read | Medium | Use large fonts, short bios, and high-contrast cards |
| In-headset profile entry is slow | Medium | Keep fields concise, support the Quest system keyboard, and retain one-click editable defaults |
| Venue Wi-Fi is unreliable | High | Bring a dedicated hotspot if hackathon rules permit |
| User movement creates safety concerns | High | Use a clear, obstacle-free demo area |

## 19. Demo scenario

### Participants

**Alex**

- Building a wearable navigation system
- Skills: embedded systems, C++, electronics
- Looking for: computer-vision expertise

**Maya**

- Building visual assistance software
- Skills: Python, computer vision, machine learning
- Looking for: a hardware and embedded-systems collaborator

### Demonstration

1. Alex and Maya put on their Quest 2 headsets.
2. Each loads a default profile, previews it, and may edit any field.
3. Both join room `DEMO`.
4. Both calibrate at the marked location.
5. Each sees the other person's name, profile tags, and supplied social handles.
6. The backend evaluates their profiles without using social links.
7. Both profile cards animate to green.
8. Both users see:

> You are both building assistive technology. Maya brings computer-vision expertise, while Alex can help deploy it on wearable hardware.

9. The presenter explains that attendees can create their own profiles and make useful connections visible without searching a directory.

## 20. Stretch goals

- Shared Spatial Anchors
- Quest 3/3S person detection using supported passthrough-camera access
- Voice-based profile creation
- Hand gesture to request a connection
- Mutual acceptance before showing the full explanation
- Multiple compatibility categories
- Directional indicators for matched users
- Match history
- Event organizer dashboard
- Quest 3 color-passthrough support
- Embedding-based candidate filtering for larger events
- Spatial audio notification when a match is nearby

## 21. Final MVP acceptance checklist

- [ ] Quest application launches without a computer connection.
- [ ] Passthrough displays the physical room.
- [ ] Two headsets can join the same session.
- [ ] A user can create, preview, edit, and save a profile.
- [ ] Optional social links display to other participants but are excluded from AI matching input.
- [ ] Alex and Maya remain available as editable demo defaults.
- [ ] Manual calibration works.
- [ ] Remote head transforms are synchronized.
- [ ] Cards appear only for connected, calibrated, in-range, in-view participants with a recent valid pose.
- [ ] Quest 2 participant placement does not request or process passthrough camera frames.
- [ ] Profile cards appear above the correct participants.
- [ ] Text is readable on Quest 2.
- [ ] AI or fallback matching produces a result.
- [ ] Compatible cards turn green.
- [ ] Both users see the same explanation.
- [ ] Recalibration works during the demo.
- [ ] The experience can be reset quickly.
- [ ] A backup demonstration video has been recorded.

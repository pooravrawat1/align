# Align Matching Rubric

The AI scores the networking-fit route for every pair out of 100 using the following rubric. The Quest demo's final score also considers the human-connection routes defined below.

## 1. Skill-to-Need Fit — 30 points

Measures whether one person's skills match what the other person is looking for.

The AI checks both directions:

- Whether Person A has skills Person B needs
- Whether Person B has skills Person A needs

A pair receives the highest score when both people can provide skills that the other person is actively seeking.

## 2. Networking-Goal Compatibility — 25 points

Measures whether both people want compatible outcomes from the networking event.

Examples include:

- Finding a project collaborator
- Finding a technical teammate
- Finding or offering mentorship
- Getting project feedback
- Finding a cofounder
- Meeting potential users or customers
- Learning about a particular field

A pair receives a higher score when one person's networking goal directly complements the other person's goal.

## 3. Project or Problem Alignment — 15 points

Measures how closely the attendees' projects or areas of work relate to each other.

The AI compares:

- The problems they are solving
- Their project domains or industries
- Technologies they use
- Their target users
- Their research or hackathon categories

A pair receives a higher score when their projects could complement each other or when they are solving closely related problems.

## 4. Mutual Benefit — 15 points

Measures whether both attendees can gain something useful from meeting.

The AI considers:

- What Person A can offer Person B
- What Person B can offer Person A

A pair receives the highest score when the value is clear in both directions. A mostly one-sided connection receives fewer points.

## 5. Shared Interests — 10 points

Measures the amount of meaningful common ground between the two attendees.

Examples include:

- Shared technical interests
- Shared industries
- Shared research topics
- Shared communities or causes
- Shared product areas

Specific interests such as `assistive robotics` are more valuable than broad interests such as `technology`, `AI`, or `startups`.

## 6. Conversation Potential — 5 points

Measures whether the profiles provide a clear and specific reason for the two people to start a conversation.

A strong result allows Align to generate:

- A concise reason they should meet
- A useful opening question
- A topic based on information from both profiles

The AI should not award points when the only possible explanation is generic, such as “You are both innovative people.”

## Total Score

| Rubric category | Maximum points |
|---|---:|
| Skill-to-Need Fit | 30 |
| Networking-Goal Compatibility | 25 |
| Project or Problem Alignment | 15 |
| Mutual Benefit | 15 |
| Shared Interests | 10 |
| Conversation Potential | 5 |
| **Total** | **100** |

## Quest demo extension: human connection

The six categories above remain the **networking-fit route**. The Quest demo also
scores self-declared past experiences so that a useful introduction need not be
purely transactional. The final percentage is the highest of networking fit,
professional shared experience, and personal shared experience. A score of 70
or more is a match. The score is hidden in the headset; a clearly labeled
post-match sample recap on the separate web companion may show the percentage.

Only experiences explicitly supplied in a profile count. Do not infer where
someone has been or count the event the two people are currently attending.

### Professional shared experience

| Strongest connection | Base score |
|---|---:|
| Same named event in the same year | 90 |
| Same named event in different years | 80 |
| Same kind of past event, such as different hackathons | 70 |
| No shared event or event kind | 0 |

Add 5 for a shared interest and 5 for a skill that meets the other person's
stated need, only when the base score is positive. Cap the route at 100.

### Personal shared experience

| Strongest connection | Base score |
|---|---:|
| Same specific destination or activity | 45 |
| Same broad kind of activity | 20 |
| No shared activity kind | 0 |

Only with a positive base score, add 25 for an overlapping self-declared work
domain, 15 for a shared interest, 10 for a skill that meets the other person's
stated need, and 5 when those facts support a specific opening question. Cap
the route at 100. A personal experience alone cannot reach the match threshold;
a specific one plus work-domain alignment can.

The matching service uses `networkingGoal`, `domains`, and `experiences` in
addition to bio, interests, skills, and `lookingFor`. Each experience records
`category` (`professional` or `personal`), `kind`, `label`, and optional `year`.
Matching fields are hidden from other attendees; only the name and a matched
conversation starter appear above a person. Reasons must use supplied facts,
contain at most 30 words, and avoid sensitive or unsupported inferences.

For the fixed, fictional Quest fixtures, Alex/Maya score 100 on the
professional-experience route (90 for the same past event, 5 for a shared
interest, 5 for a skill-to-need connection). Alex/Sam and Maya/Sam have no
qualifying shared experience or concrete networking fit in the demo fixture;
their bundled offline results are 0 and neutral. These example results are
checked against the fixture in automated tests.

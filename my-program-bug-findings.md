# My Program Bug Findings

The supplied screen recording does not show the generation-completion moment itself, so the missing confetti must be diagnosed from the My Program generation lifecycle code rather than from visible video evidence.

The recording does clearly show a mismatch between the horizontal training day selector and the scheduled dates shown inside workout cards. Visual findings from the video analysis:

| Recording time | Horizontal selector / card heading | Date pill shown in card | Issue |
| --- | --- | --- | --- |
| 00:01–00:03 | Tuesday | WED, MAY 13 | Selected weekday and scheduled date weekday do not match. |
| 00:04–00:06 | Wednesday | FRI, MAY 15 | Selected weekday and scheduled date weekday do not match. |
| 00:06–00:08 | Thursday | SUN, MAY 17 | Selected weekday and scheduled date weekday do not match. |

Working hypothesis: the UI is using generated day labels for tab headings while date pills are derived from a separate scheduled-date field, likely after rest-day gaps or persisted schedule mapping. The selected tab labels should be derived from the actual scheduled date when present, or the generated workout object should be normalized so both the selector and card use the same date source.

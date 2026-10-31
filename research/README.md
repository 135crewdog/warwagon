# research

The public documents War Wagon's flight model is built from, and what's been made from them. `docs/kc135-sources.md` is the source register; `docs/research-plan.md` says what each document is for and how charts are read.

## Getting the documents

The PDFs live on the `research-archive` branch, not here, so development clones stay small. Clone with `git clone --single-branch` to leave the archive out. When you need the documents:

```
sh research/fetch.sh
```

This copies them out of the archive into this folder, where git ignores them, and checks each one against `sources.sha256`. To add a document: commit it to `research-archive` with its checksum, and add its checksum and its row in the log below here, in the same piece of work.

## What's here

- `fetch.sh`, `sources.sha256`: as above.
- `charts/`: the chart images cut from the documents, one per figure, named `<ID>-fig<number>.png`.
- `check/`: the overlay images, made by `overlay.py`, with the digitized points drawn over each chart.
- `overlay.py`: a dev-only script, not part of the app (it will be added with the first chart).

The raw research notes behind `docs/kc135-sources.md` are kept out of this repo: some hold numbers from sources awaiting an owner decision.

## Distribution log

Every document is logged here before anything is read from it. Only documents approved for public release are archived. "Cover" is what the document's own report-documentation page or cover says; "NTRS" is the record's distribution and copyright fields, read on 31 October 2026.

| ID | Document | Source | Cover | NTRS |
|---|---|---|---|---|
| A1 | NASA TM 73,250 (Hedstrom & Whitcomb 1977), 0.035-scale modified NKC-135 at Mach 0.28 | https://ntrs.nasa.gov/citations/19780004068 | Distribution statement: "Unlimited"; for sale by NTIS | Public; public use permitted |
| A2 | NASA TP-1119 (Meyer 1978), winglets IV, full-span model at Mach 0.30 | https://ntrs.nasa.gov/citations/19780010054 | "Unclassified - Unlimited" | Public; public use permitted |
| A4 | NASA TM-85920 (Curry & Bowers 1985), ground-effect analysis of a jet transport | https://ntrs.nasa.gov/citations/19850007378 | "Unclassified-Unlimited" | Public; public use permitted |
| A5 | Montoya, *KC-135 Winglet Flight Results* (NASA Dryden, c. 1980) | https://ntrs.nasa.gov/citations/19810010485 | No statement in this copy (a conference paper) | Public; public use permitted. The register's open question on A5 is settled: usable |
| A6 | NASA CP-2211, *KC-135 Winglet Program Review* (1982), the whole proceedings | https://ntrs.nasa.gov/citations/19840019618 | No statement on the pages read | Public; public use permitted |
| A7 | NASA TP-1163 (Jacobs 1978), winglets V, high subsonic speeds | https://ntrs.nasa.gov/citations/19780012138 | "Unclassified - Unlimited" | Public; public use permitted |
| A8 | NASA TN D-8473 (Jacobs, Flechner & Montoya 1977), winglets I, semispan model | https://ntrs.nasa.gov/citations/19780012121 | "Unclassified - Unlimited" | Public; public use permitted |
| R1 | NASA CR-73277, Boeing D6-20659-1 (1968), summary report | https://ntrs.nasa.gov/citations/19690003073 | NASA contractor-report statement: distributed "in the interest of information exchange" | Public; public use permitted |
| R1 | NASA CR-73276, Boeing D6-20659-4 Appendix C (1968), 707-320B derivative tables | https://ntrs.nasa.gov/citations/19690003076 | Handwritten on the cover: "CR 73276 available to the public" | Public; public use permitted |
| R2 | NASA TN D-3971 (1967), the 367-80 in-flight simulator | https://ntrs.nasa.gov/citations/19670019704 | For sale by the Clearinghouse for Federal Scientific and Technical Information | Public; public use permitted |
| R3 | NASA TN D-4804 (Crane, Sommer & Healy 1968), 367-80 approach handling | https://ntrs.nasa.gov/citations/19680027603 | For sale by the Clearinghouse for Federal Scientific and Technical Information | Public; public use permitted |

Note: Appendix C of D6-20659 is NASA CR-73276 (the register gives only the summary's number, CR-73277).

**Read but not archived**, because the copyright forbids copying the document; the facts in it are used, with a citation:

| ID | Document | Source | Statement |
|---|---|---|---|
| E1 | EASA TCDS E.066, CFM56-2 and -3 series, Issue 02 (17 March 2023) | https://www.easa.europa.eu/en/downloads/7691/en | "© European Union Aviation Safety Agency. All rights reserved." and "Proprietary document. Copies are not controlled." Published openly by EASA |

## Still to upload

DTIC (`apps.dtic.mil`) and AFIT (`scholar.afit.edu`) refuse automated downloads from Claude's cloud session, so these need downloading in a browser and uploading:

| ID | Document | Source |
|---|---|---|
| A3 | AFFDL-TR-77-23 | https://apps.dtic.mil/sti/tr/pdf/ADA046152.pdf |
| G6 | Crenshaw 1976 (only its bibliography is read, for Owner decision 1) | https://apps.dtic.mil/sti/pdfs/ADA034940.pdf |
| G5 | J. Smith 2007, AFIT | https://scholar.afit.edu/cgi/viewcontent.cgi?article=3971&context=etd |
| F1, F2, F4–F6, F9 | The refuelling sources | In the register. Not needed until refuelling, which is parked |

Also still to fetch: G2 (the Shell 77 report, from the Air Force FOIA reading room), E2 (the ICAO emissions databank spreadsheet) and E3 (the OpenAP paper). MDPI, which publishes E3, refused the session too.

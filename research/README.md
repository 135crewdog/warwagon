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

Downloaded on 31 October 2026 from the owner's shared folder, after DTIC, AFIT and MDPI refused the session's own downloads. The statement is the document's own cover or documentation page, read by eye:

| ID | Document | Source | Statement |
|---|---|---|---|
| A3 | AFFDL-TR-77-23 (Ishimitsu & Zanton, Boeing D6-45090, May 1977), *Design and Analysis of Winglets for Military Aircraft, Phase II* | https://apps.dtic.mil/sti/tr/pdf/ADA046152.pdf | "Approved for public release; distribution unlimited" on the cover and the DD 1473; the notice page says it is releasable to NTIS and the general public |
| G6 | Crenshaw, *Stability and Control Characteristics of the Winglet Configured KC-135A*, AFIT GAE/MC/76D-5, December 1976 | https://apps.dtic.mil/sti/pdfs/ADA034940.pdf | "Distribution Statement A: Approved for public release; distribution unlimited" on the cover and title page. Note: DDC's stamp says the copy "does not permit fully legible production"; the scan is readable by eye. Only its bibliography is read until Owner decision 1 |
| F2 | Mortensen, *Improved Load Alleviation Capability for the KC-135*, AFIT/GE/ENY/97S-01, September 1997 | https://scholar.afit.edu (AFIT Scholar copy) | "Approved for public release; distribution unlimited" |
| G5 | J. J. Smith, *Simulation of the Dynamically Coupled KC-135 Tanker and Refueling Boom*, AFIT, March 2007 | https://scholar.afit.edu/cgi/viewcontent.cgi?article=3971&context=etd | "Approved for public release; distribution unlimited" |
| G2 | USAF Aircraft Accident Investigation Board report, KC-135R T/N 63-8877, 3 May 2013 (Shell 77) | Air Force FOIA reading room; mirror https://code7700.com/pdfs/usaf/usaf_aib_050313_kc135_manas.pdf | Prepared under AFI 51-503 as "a publicly-releasable report". Only the board's own findings are used; every passage it cites to the inflight manual (its Tab BB) is excluded |
| E3 | Sun, Hoekstra & Ellerbroek, *OpenAP: An Open-Source Aircraft Performance Model…*, Aerospace 7(8):104, 2020 | https://www.mdpi.com/2226-4310/7/8/104 | Creative Commons Attribution 4.0 (CC BY), stated on its last page |

**Read but not archived**, because the copyright forbids copying the document or no licence is stated; the facts in them are used, with a citation:

| ID | Document | Source | Statement |
|---|---|---|---|
| E1 | EASA TCDS E.066, CFM56-2 and -3 series, Issue 02 (17 March 2023) | https://www.easa.europa.eu/en/downloads/7691/en | "© European Union Aviation Safety Agency. All rights reserved." and "Proprietary document. Copies are not controlled." Published openly by EASA |
| E2 | ICAO Aircraft Engine Emissions Databank, version 32, `edb-emissions-databank_v32__web_.xlsx` | https://www.easa.europa.eu/en/domains/environment/icao-aircraft-engine-emissions-databank | No licence or copyright text anywhere in the workbook; ICAO material, so not copied. Its CFM56-2 rows (UIDs 1CM001–1CM003) were read and match the register |

**Not a source:** `ADA061313.pdf`, uploaded by mistake, is AFFDL-TR-77-60, a bird-strike study. Not archived.

## Not yet fetched

The refuelling sources F1, F4, F5, F6 and F9 (in the register). Not needed until refuelling, which is parked. DTIC and AFIT refuse automated downloads from Claude's cloud session, so they will need downloading in a browser when the time comes.

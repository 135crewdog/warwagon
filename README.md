# War Wagon research archive

This branch only stores the source documents War Wagon's flight model is built from. It shares no history with the development branches, so their clones can leave it out (`git clone --single-branch`).

- `research/*.pdf`: the documents, named by their ID in `docs/kc135-sources.md` (the source register on the development branches).
- `research/sources.sha256`: their checksums.

What each document is, where it came from and its distribution statement are logged in `research/README.md` on the development branches. Only documents approved for public release are added here, and each is logged there first. `research/fetch.sh` on a development branch copies these files out into its own `research/`, where they are ignored by git.

Add a document by committing it here with its checksum, and logging it on the development branch in the same piece of work.

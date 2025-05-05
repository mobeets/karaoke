## How to add a new song

- Find your song on [USDB](https://usdb.animux.de/), download the TXT file, and put it in `usdb/`.
- Download the mp3 using `yt-dlp -x --audio-format mp3 URL`, replacing URL with a youtube link to the song, and put the mp3 in `mp3/` following the naming convention of other songs.
- Run `python lyrics.py`, which will create a .json file in `notes/`, and ensure the scripts can see the mp3 file.

## How to add a new song

- Find your song on [USDB](https://usdb.animux.de/), download the TXT file, and put it in `usdb/`
- Convert the .txt file to .json by running `python lyrics.py`
- Download the mp3 using `yt-dlp -x --audio-format mp3 URL`, replacing URL with a youtube link to the song, and put the mp3 in `mp3/`
- Add a new entry to `songs.json`. Make sure 'value' is the name of the .mp3 and .json file

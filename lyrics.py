#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Fri Jul  1 19:04:05 2022

@author: mobeets
"""

import string
import json
import numpy as np
import matplotlib.pyplot as plt
from mido import MidiFile

#%%

mid = MidiFile('/Users/mobeets/Downloads/Let It Be - The Beatles (demo).mid', clip=True)
S = np.array(mid.tracks[0])

#%%

times = np.cumsum([x.time for x in S]).astype(int)
tempos = np.array([(i,x) for i,x in enumerate(S) if hasattr(x, 'type') and x.type == 'set_tempo'])
words = np.array([(i, x.text.strip()) for i,x in enumerate(S) if x.type == 'lyrics' and x.text.strip()])
channels = list(set([x.channel for x in S if hasattr(x, 'channel')]))
counts = [len([x for x in S if hasattr(x, 'channel') and x.channel == i and x.type == 'note_on']) for i in channels]

#%%

# note: let it be has double the number of notes for some reason
# and a header full of meta junk, probably as used during karaoke

# channel = channels[np.argmin((np.array(counts) - len(words))**2)]
channel = 3
notes = np.array([(i, x.note) for i,x in enumerate(S) if hasattr(x, 'channel') and x.channel == channel and x.type == 'note_on'])

# plt.plot(times[notes[:,0].astype(int)], '.-', label=channel, markersize=3)
# plt.plot(times[words[:,0].astype(int)], '.-', markersize=3, label='lyrics')

ws = words
ns = notes[::2]
zs = list(zip(ns, ws))[23:-1]
first_time = int(times[zs[0][0][0]])
last_time = int(times[zs[-1][0][0]])

notes = [{'time': int(times[t]) - first_time, 'note': int(n), 'name': w} for (t,n),(_,w) in zs]
tempo_times = [{'time': int(times[i]) - first_time, 'tempo': int(x.tempo)} for i,x in tempos if times[i] < last_time]
first_tempo_time = max([x['time'] for x in tempo_times if x['time'] < 0])
tempo_times = [x for x in tempo_times if x['time'] > 0 or x['time'] == first_tempo_time]

song = {'name': 'Let It Be', 'notes': notes, 'tempos': tempo_times, 'ticks_per_beat': mid.ticks_per_beat}

json.dump(song, open('/Users/mobeets/code/karaoke-trainer/static/songs/let-it-be.json', 'w'))

#%%

plt.plot(times[words[:,0].astype(int)], '.-', markersize=3, label='lyrics')
for channel in channels:
    notes = np.array([(i, x.note) for i,x in enumerate(S) if hasattr(x, 'channel') and x.channel == channel and x.type == 'note_on'])
    if len(notes) == 0:
        continue
    plt.plot(times[notes[:,0].astype(int)], '.-', label=channel, markersize=3)
plt.legend()
    
#%%

def msg2dict(msg):
    result = dict()
    if 'note_on' in msg:
        on_ = True
    elif 'note_off' in msg:
        on_ = False
    else:
        on_ = None
    result['time'] = int(msg[msg.rfind('time'):].split(' ')[0].split('=')[1].translate(
        str.maketrans({a: None for a in string.punctuation})))

    if on_ is not None:
        for k in ['note', 'velocity']:
            result[k] = int(msg[msg.rfind(k):].split(' ')[0].split('=')[1].translate(
                str.maketrans({a: None for a in string.punctuation})))
    return [result, on_]

def switch_note(last_state, note, velocity, on_=True):
    # piano has 88 notes, corresponding to note id 21 to 108, any note out of this range will be ignored
    result = [0] * 88 if last_state is None else last_state.copy()
    if 21 <= note <= 108:
        result[note-21] = velocity if on_ else 0
    return result

def get_new_state(track, last_state, channel=None):
    new_msg, on_ = msg2dict(str(track))
    new_state = switch_note(last_state, note=new_msg['note'], velocity=new_msg['velocity'], on_=on_) if on_ is not None else last_state
    if channel is not None and hasattr(track, 'channel') and track.channel != channel:
        new_state = last_state
    return [new_state, new_msg['time']]

def track2seq(track, channel=None):
    # piano has 88 notes, corresponding to note id 21 to 108, any note out of the id range will be ignored
    result = []
    last_state, last_time = get_new_state(str(track[0]), [0]*88)
    for i in range(1, len(track)):
        new_state, new_time = get_new_state(track[i], last_state, channel=channel)
        if new_time > 0:
            result += [last_state]*new_time
        last_state, last_time = new_state, new_time
    return result

def mid2array(mid, min_msg_pct=0.1, channel=None):
    tracks_len = [len(tr) for tr in mid.tracks]
    min_n_msg = max(tracks_len) * min_msg_pct
    # convert each track to nested list
    all_arys = []
    for i in range(len(mid.tracks)):
        if len(mid.tracks[i]) > min_n_msg:
            ary_i = track2seq(mid.tracks[i], channel=channel)
            all_arys.append(ary_i)
    # make all nested list the same length
    max_len = max([len(ary) for ary in all_arys])
    for i in range(len(all_arys)):
        if len(all_arys[i]) < max_len:
            all_arys[i] += [[0] * 88] * (max_len - len(all_arys[i]))
    all_arys = np.array(all_arys)
    all_arys = all_arys.max(axis=0)
    # trim: remove consecutive 0s in the beginning and at the end
    sums = all_arys.sum(axis=1)
    ends = np.where(sums > 0)[0]
    return all_arys[min(ends): max(ends)]

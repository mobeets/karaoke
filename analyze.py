#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu Jun 23 13:31:55 2022

@author: mobeets
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA

import matplotlib as mpl
mpl.rcParams['font.size'] = 14
mpl.rcParams['figure.figsize'] = [3.0, 3.0]
mpl.rcParams['figure.dpi'] = 300
mpl.rcParams['axes.spines.right'] = False
mpl.rcParams['axes.spines.top'] = False

#%%

def getOctaveBands(N, fCtr0=16.3516, sampleRate=44100):
    octaveBands = []
    lastFrequencyBand = {
        'lo': fCtr0 / (2 ** (1 / (2 * N))),
        'ctr': fCtr0,
        'hi': fCtr0 * (2 ** (1 / (2 * N)))
    }
    octaveBands.append(lastFrequencyBand)
    nyquist = sampleRate / 2

    while (lastFrequencyBand['hi'] < nyquist):
        newFrequencyBand = {}
        newFrequencyBand['lo'] = lastFrequencyBand['hi']
        newFrequencyBand['ctr'] = lastFrequencyBand['ctr'] * (2 ** (1 / N))
        newFrequencyBand['hi'] = newFrequencyBand['ctr'] * (2 ** (1 / (2 * N)))
        octaveBands.append(newFrequencyBand)
        lastFrequencyBand = newFrequencyBand
    return octaveBands

def plot3d(zs, xs, show=True):
    fig = plt.figure()
    ax = fig.add_subplot(projection='3d')
    
    xss = np.unique(xs)
    mus = []
    for x in xss:
        ix = (xs == x)
        # plt.plot(zs[ix,0], zs[ix,1], zs[ix,2], '.', markersize=5, alpha=0.5)
        mus.append(zs[ix,:].mean(axis=0))
    mus = np.vstack(mus)
    plt.plot(mus[:,0], mus[:,1], mus[:,2], '.-', markersize=5, alpha=0.5)

    plt.xlabel('$z_1$')
    plt.ylabel('$z_2$')
    ax.set_zlabel('$z_3$')
    ax.set_xticks([]); ax.set_yticks([]); ax.set_zticks([])
    ax.view_init(elev=40., azim=45)
    plt.tight_layout()
    if show:
        plt.show()

def plot_pca(pca, show=True):
    plt.plot(np.arange(pca.n_components) + 1, 100*pca.explained_variance_ratio_, '.-')
    plt.xlabel('# PCs')
    plt.ylabel('% variance explained')
    plt.plot([1, pca.n_components], [0, 0], 'k-', alpha=0.25)
    if show:
        plt.show()

#%% load all data

data = json.load(open('data/data.json'))
data2 = json.load(open('data/data2.json'))
data = data + data2
octave_bands = np.array([x['ctr'] for x in data[0]['octaveBands']])

#%% visualize samples

xoff = 0
for i,d in enumerate(data[:10]):
    y = np.array(d['userInputs']) # nframes x nfeatures
    t = np.argmax(np.sum(y ** 2, 1))
    x = np.arange(y.shape[0])
    plt.plot(x + xoff, y)
    plt.plot((x[t] + xoff)*np.ones(2), [0, 255], 'k-', alpha=0.3)
    xoff += len(x)

#%% collect one sample per note

nfeatures = len(data[0]['userInputs'][0])
xs = np.zeros((len(data),))
ys = np.zeros((len(data), nfeatures))
ps = np.zeros((len(data),))
for i,d in enumerate(data):
    y = np.array(d['userInputs']) # nframes x nfeatures
    t = np.argmax(np.sum(y ** 2, 1))
    ys[i] = y[t] / np.linalg.norm(y[t]) # does this normalize amplitude?
    xs[i] = d['curStep']
    ps[i] = np.argmax(y[t])
ix = ~np.isnan(ys.sum(axis=1))
xs = xs[ix]
ys = ys[ix]
ps = ps[ix]

plt.plot(xs, '.'); plt.plot(np.log(octave_bands[ps.astype(int)]), '.')

#%% apply PCA

ndims = 20
pca = PCA(n_components=ndims)
pca.fit(ys)
zs = pca.transform(ys)
plot_pca(pca)

#%% visualize

plot3d(zs, xs)# % 12)

# Fourier Transform - A visual Introduction
This repository contains a Jupyter notebook which is based on an amazing video by <a href = "https://www.youtube.com/channel/UCYO_jab_esuFRV4b17AJtAw"><b>3Blue1Brown</b></a>, which can be found <a href = "https://www.youtube.com/watch?v=spUNpyF58BY"><b>here</b></a>, as well as embedded in the notebook, explaining the quite widely ungrasped topic of Fourier Transform, in a very intuitive, visually stimulating and satisfying way.

<centre> <img src = "https://img.youtube.com/vi/spUNpyF58BY/maxresdefault.jpg"> </centre>

<b>Dependencies :</b>
* Numpy
* Matplotlib
* Seaborn (to make your plots look beautiful)

Installation is quite simple :
```
pip3 install --user numpy
pip3 install --user matplotlib
pip3 install --user seaborn
```

<b>Static web version :</b> open `index.html` in any browser, or jump straight to `fourier_transform.html` (the winding machine and the center of mass) and `laplace_transform.html` (the same machine with a real exponent added: σ envelopes, poles and the region of convergence). Both are single files with no build step; only mathjs loads from a CDN, and formulas are typeset by the pages' built-in mini TeX renderer.

<b>Site-wide navigation drawer :</b> the three pages also load the repository-root drawer (`../assets/drawer.css` + `../assets/drawer.js`, linked before `</head>` and before `</body>` with `defer`), which lists every page of the whole site behind the hamburger tab on the left. Two consequences. This directory can no longer be copied out and used on its own as it could before — the pages still work, but the drawer would 404. And the pages stay network-self-contained: the drawer is local relative CSS/JS, with no CDN and no npm dependency.

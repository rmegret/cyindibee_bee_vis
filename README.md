# D3 Project - Visualization of Bee Datasets

To run, launch a local HTTP server:
```
python3 -m http.server 8001
```
and open a browser at port 8001 to access `index.html`

# Structure of the project:

- `index.html` main page from which the javascript is loaded
- `js/main.js` main javascrip code
- `js/d3.v6.min.js` D3 library used for visualization
- `css/style.css` global CSS file to style the page
- `data/` folder where data is stored (see below)

# Datasets

New GUI target `data/reid` dataset, too big to version here.


The content of `data/flowerpatch` is in this repo it has the following structure:
```
data/flowerpatch
data/flowerpatch/flowerpatch_20240606_11h04.tracks_visits.csv
data/flowerpatch/flowerpatch_20240606_11h04.visits.csv
data/flowerpatch/flowerpatch_20240606_11h04.flowers.csv
data/flowerpatch/flowerpatch_20240606_11h04.bee_labels.csv
data/flowerpatch/crops
data/flowerpatch/crops/T0228_F0529.jpg
... more image files ...
```

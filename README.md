# D3 Project - Visualization of Bee Datasets

Walthrough (change 8001 for any available port)
```
# LOCAL MACHINE
ssh deeppollinator -L 8001:localhost:8001   # Forward 8001 port to your local machine

# ON bigdbee OR deeppollinator machine
# Pick up a loca directory
git clone --depth 1 git@github.com:rmegret/cyindibee_bee_vis.git
cd cyindibee_bee_vis   # The top-level one, that has the index.html
python3 -m http.server 8001
# This will serve the GUI from index.html
# Normally this port is not accessible from outside, do not use this way if firewall is down

# Visit localhost:8001
# Click on button <Open JSON dataset...>
# Select the dataset.json
# Check the console (Shift+Ctrl+I) for any error
# You can verify the proper loading of the config with gui.dataset and check manually if the paths are accessible through the python webserver
```

To visualize your own data. See examples in `/mnt/data/users/rmegret/cyindibee_bee_vis/data/`
```
cd data/   # inside cyindibee_bee_vis (there is a .gitignore for that folder)
mkdir mydataset
cd mydataset
ln -s /path_to_your_crop_images crops/
cp /path_to_your_tracks.csv . # need a column crop_file
touch mydataset_config.json   # fill the config following the structure below
```

`mydataset_config.json` should follow the structure:
```
{
  "tracks_csv":"summer_bee_dataset_open_train_bee_64_ids_batch2_sample_num_max.csv",
  "crops_dir":"images/",
  "features_csv":"batch_1_train_embeddings_26w82ua9.csv"
}
```
The paths are relative to the JSON file.

Note: The demo dataset `flowerpatch_20240606_11h04.dataset_single_crop.json` is pushed to the repository as example, but contains only one crop per track.
The full demo image dataset for `flowerpatch_20240606_11h04.dataset_all_crops.json` is 145MB, available at `/mnt/data/users/rmegret/cyindibee_bee_vis/data/flowerpatch/crops_all`.


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
data/flowerpatch/flowerpatch_20240606_11h04.dataset_single_crop.json
data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv
data/flowerpatch/flowerpatch_20240606_11h04.visits.csv
data/flowerpatch/flowerpatch_20240606_11h04.flowers.csv
data/flowerpatch/flowerpatch_20240606_11h04.bee_labels.csv
data/flowerpatch/crops
data/flowerpatch/crops/T0228_F0529.jpg
... more image files ...
```

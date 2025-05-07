

var gtracks = {}
var scrub_on = false
var show_features = false
var gui

async function show_track_util() {
  console.log('show_track_util')

  const main = d3.select('#main')

  //gtracks.visits = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv')
  //gtracks.tracks = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv')
  //const tracks = await d3.csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv')
  let tracks = await d3.csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch2_sample_num_max.csv')

  convert_columns_to_number(tracks, ['key','track_id','frame','pass'])
  // Sanitize pass
  for (det of tracks) {
    det['pass'] = Math.round(det['pass'])
    det['track_key'] = `B${det['batch']}_E${det['environment']}_b${det['background']}_P${det['pass']}_r${det['bee_range']}_T${det['track_id']}`
  }
  //tracks = d3.sort( tracks, d => d.new_filepath ) // Do not sort to keep keys aligned
  console.log(`show_track_util: tracks loaded, ${tracks.length} rows`)

  gui = new TrackSplitGUI({parentElement: main.node(),
                           tracks: tracks
                          })
}

// Mixin to make a D3 class component advertise its events in a simple way
function makeDispatchable(obj, eventNames) {
  const _dispatcher = d3.dispatch(...eventNames);

  // Expose .on
  //obj.on = _dispatcher.on.bind(_dispatcher);
  obj.on = function(type, listener) {
    _dispatcher.on(type, listener);
    return obj;
  };

  // Add .emit or .trigger as a wrapper for call()
  obj._emit = function(type, ...args) {
    _dispatcher.call(type, obj, ...args);
  };

  return obj;
}

function throttleTrailing(fn, interval) {
  let lastTime = 0;
  let timeout = null;
  let lastArgs = null;

  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastTime = now;
      fn.apply(this, args);
    } else {
      lastArgs = args;
      if (!timeout) {
        timeout = setTimeout(() => {
          lastTime = Date.now();
          fn.apply(this, lastArgs);
          timeout = null;
        }, remaining);
      }
    }
  };
}

function scrollToCenter(container, target, scrollBehavior = "smooth") {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const scrollLeft = container.scrollLeft + 
    (targetRect.left + targetRect.width / 2) - 
    (containerRect.left + containerRect.width / 2);

  const scrollTop = container.scrollTop + 
    (targetRect.top + targetRect.height / 2) - 
    (containerRect.top + containerRect.height / 2);

  container.scrollTo({ left: scrollLeft, top: scrollTop, 
                        behavior: scrollBehavior });
}
throttledScrollToCenter = throttleTrailing(scrollToCenter, 100)


class CropGallery {
  constructor(_config) {
    const view = this
    view.config = {
      parentElement: _config.parentElement,
      showToolbar: _config.showToolbar,
      autoScrollToCenter: _config.autoScrollToCenter,
      // containerWidth: 1100,
      // containerHeight: 800,
      // tooltipPadding: 15,
      // margin: {top: 60, right: 20, bottom: 20, left: 45},
      // legendWidth: 160,
      // legendBarHeight: 10
    }
    view.track = [];
    view.gallery = [];
    view.filter = null

    view.scrubbed = undefined
    view.selected = {} // Mapping (item) => bool

    makeDispatchable(view, ["item-selected","item-unselected","gallery-changed"])

    view.init()
  }

  init() {
    const view = this
    
    const container = d3.select(view.config.parentElement)
      .append('div')
      .attr('class','crop-list-view')
    view.container = container

    /* SELECTION TOOLBAR */
    const buttons_div_filter = container.append("div")
      .attr('class','buttons-div flex-container')
      buttons_div_filter.append("button").text("Filter ALL")
          .on('click', () => view.set_filter(null))
    buttons_div_filter.append("button").text("Filter HAS BEE_ID")
        .on('click', () => view.set_filter('bee_id', true))
    buttons_div_filter.append("button").text("Filter NO BEE_ID")
        .on('click', () => view.set_filter('bee_id', false))

    const buttons_div_select = container.append("div")
        .attr('class','buttons-div flex-container')
        .style('display', view.config.showToolbar?'block':'none');

    const divleft = buttons_div_select.append('div').attr('class','flex-left')
    divleft.append("button").text("Select BEFORE")
      .on('click', () => view.select('before'))
    divleft.append("button").text("Unselect BEFORE")
      .on('click', () => view.unselect('before'))

    const divcenter = buttons_div_select.append('div').attr('class','flex-center')
    divcenter.append("button").text("Select ALL")
      .on('click', () => view.select('all'))
      divcenter.append("button").text("Unselect ALL")
      .on('click', () => view.unselect('all'))

    const divright = buttons_div_select.append('div').attr('class','flex-right')
    divright.append("button").text("Select AFTER")
      .on('click', () => view.select('after'))
      divright.append("button").text("Unselect AFTER")
      .on('click', () => view.unselect('after'))

    /* GALLERY TRACK VIEW */
    const track_div = container.append("div")
      .attr('class','track-div')
    view.track_div = track_div

    const track_items = view.track_div.append('div')
      .attr('class', 'track-items')
      .style('display', 'flex') // Use flexbox for horizontal layout
      .style('flex-wrap', 'nowrap') // Prevent wrapping of images
      .style('overflow-x', 'auto') // Add horizontal scrollbar if needed
      .style('white-space', 'nowrap') // Ensure images stay on one line
    view.track_items = track_items

    track_items.on('keydown', (evt) => view.onkeypress(evt))
        .attr("tabindex", "1")

    console.log("crop_list_view initialized");
  }
  load_track(track, append=false) {
    if (append)
      this.track.push(...track)
    else
      this.track = track
    this.reorder()
    this.update()
  }
  reorder(mode, similarity) {
    const view = this
    if (mode == undefined)
      view.gallery0 = view.track.map( (item, index) => ({item:item, selected:false, order:item.new_filepath}) )
    if (mode == 'similarity') {
      view.gallery0 = view.gallery0.map( (gallery_item, index) => ({item:gallery_item.item, selected:false, similarity:similarity[index], order: -similarity[index]}) )
    }
    view.gallery0 = d3.sort(view.gallery0, x => x.order)
    view.update()
    view.select_gallery_item(view.gallery[0])
  }
  reorder_by_similarity(item) {
    let sim = gui.feature_band.compute_similarity({item:item}, this.gallery0)
    console.log(sim)
    this.reorder('similarity', sim)
  }
  update() {
    const view = this
    // Rebuld the selection map
    //view.selected = new Map();
    //view.track.forEach( (item) => view.selected.set(item, false) );
    
    // Pipeline: gallery0 => filter => sort => gallery

    let tmp_gallery = view.gallery0

    if (view.filter != null) {
      let field = view.filter.field
      let flag = view.filter.flag
      tmp_gallery = tmp_gallery.filter(  d => !!d.item[field] == flag )
    }

    view.gallery = d3.sort(tmp_gallery, x => x.order)

    view._emit('gallery-changed', view.gallery)

    this.render()
  }
  render() {
    const view = this

    //const empty_default_gallery = [{item: {}, selected:false, order:0}]

    let gallery = []
    if (this.gallery.length) {
      gallery = this.gallery
    } else {
      gallery = [{item: {}, selected:false, order:0}] // Default empty gallery
    }

    // Add a container for the images in this 'track_key'
    view.track_items.selectAll('.item-container')
    //.data(view.gallery, d=>d.item.new_filepath)
    .data(gallery, d=>d.item.key)
    .join('div')
      .attr('class', 'item-container')
      .style('text-align', 'center') // Center-align the content
      .style('margin', '5px') // Add some spacing between items
      .attr('id', d => `key-${d.item.key}`)
      .each(function(d) {
          const container = d3.select(this);
  
          // Add the image
          container.html('')
              .append('img')
              .attr('class', d => `crop-img`)
              .attr('frame_id', d.item.frame_id)
              .attr('src', '/data/reid/images/'+d.item.new_filepath)
              .attr('style', 'width:128px; height:128px; display:block; margin:auto;')
              .on('click', (evt) => view.on_click_item(evt))
  
          // Add the frame ID below the image
          container.append('div')
              .attr('class', 'frame-id')
              .html(`bee <b>${d.item.bee_id}</b>`
                +`<br>cid <b>${d.item.color_id}</b>`
                +`<br>K<b>${d.item.key}</b> T<b>${d.item.track_id}</b> F<b>${d.item.frame_id}</b>`
                //+`<br>batch <b>${d.item.batch}</b>, bg <b>${d.item.background}</b>`
                //+`<br>range <b>${d.item.bee_range}</b>, pass <b>${d.item.pass}</b>`
                //+`<br>TC <b>${d.item.visit.nb_samples}</b>`
                +`<br>sim <b>${(d.similarity || NaN).toFixed(5)}</b>`
                )    // HACK: d.visit.nb_samples relies on main to insert the visit info into each detection
              .style('margin-top', '5px') // Add spacing above the text
              .style('font-size', '12px') // Adjust font size
              .style('color', '#555'); // Optional: Change text color
    });
    view.render_selection()
  }
  render_selection() {
    const view = this
    // Multi-selection
    view.track_items.selectAll('.item-container')
      //.filter(d => d.filepath == clicked_d.filepath) // Use filepath as key
      //.classed("selected", d => d.selected)
      .classed("selected", d => d.selected)  // Use a mapping to bool to avoid modifying d
    // Single scrubbed selection
    view.track_items.selectAll('.item-container')
      //.filter(d => d.filepath == clicked_d.filepath) // Use filepath as key
      //.classed("scrubbed", d => d.filepath == view.scrubbed.filepath)
      .classed("scrubbed", d => d === view.scrubbed)  // Use directly the gallery_item
  }

  focus() {
    this.track_items.node().focus();
  }
  on_click_item(evt) {
    const view = this
    const gallery_item = evt.srcElement.__data__

    if (evt.shiftKey) {// multi-selection
      view.toggle_item(gallery_item)
    } else
      view.select_gallery_item(gallery_item)
  }
  toggle_item(gallery_item, value='toggle') {
    const view = this

    // Multi-select
    if (value == 'toggle') {
      gallery_item.selected = !gallery_item.selected
    } else {
      gallery_item.selected = !!value
    }
    view.render_selection()
  }
  select_gallery_item(gallery_item) {
    const view = this

    if (gallery_item ==  null) {
      console.log("select_gallery_item: unselect")
      let old_scrubbed = view.scrubbed
      view.scrubbed = undefined
      view.render_selection()
      view._emit('item-unselected', old_scrubbed)
      return
    }

    console.log("select_gallery_item", gallery_item.item.key, gallery_item)

    view.scrubbed = gallery_item
    view.render_selection()

    view._emit('item-selected', gallery_item.item)

    // TRACK VIEW SCROLL TO CENTER
    if (view.config.autoScrollToCenter) {
      console.log('select_item, autoScrollToCenter=true', gallery_item)
      const key = gallery_item.item.key
      const container = view.track_items.node();
      //const target = view.container.selectAll(".item-container")
      //      .filter(d => d.item.key == key).node();
      const target = view.track_items.select(`.item-container#key-${key}`).node()
      throttledScrollToCenter(container, target, "instant");
    }
  }
  select_item(item) {
    const view = this

    console.log("select_item", item)

    const gallery_item = view.gallery.find(d => d.item == item);

    view.select_gallery_item(gallery_item)
  }
  set_filter(field, flag) {
    const view = this
    if (field != null)
      view.filter = {field: field, flag:flag}
    else
      view.filter = null
    this.update()
  }

  onkeypress(evt) {
    const view = this

    console.log('onkeypress:',evt)
    if (evt.srcElement != view.track_items.node()) {
      console.log('MISROUTED EVT:',evt)
      return
    }

    if (evt.code=='Digit1') {
      gui.crop_gallery.focus()
      evt.preventDefault();
      evt.stopPropagation()
    }if (evt.code=='Digit2') {
      gui.crop_gallery2.focus()
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='Escape') {
      //console.log(evt)
      view.select_gallery_item(null)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='ArrowRight') {
      //console.log(evt)
      let elts = view.gallery.filter(det => det.order > view.scrubbed.order)
      if (elts.length==0) {console.log('Already at start, ABORT'); return}
      let new_item = elts[0]
      view.select_gallery_item(new_item, true)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='ArrowLeft') {
      //console.log(evt)
      let elts = view.gallery.filter(det => det.order < view.scrubbed.order)
      if (elts.length==0) {console.log('Already at end, ABORT'); return}
      let new_item = elts[elts.length-1]
      view.select_gallery_item(new_item, true)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='Space') {
      //console.log(evt)
      let elts = view.gallery.filter(det => det.order == view.scrubbed.order)
      if (elts.length==0) {console.log('Not found, ABORT'); return}
      let new_item = elts[0]
      view.toggle_item(new_item)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyS') {
      console.log('Reordering by similarity')
      //console.log(evt)
      if (view == gui.crop_gallery)  // FIXME: non modular
        gui.crop_gallery2.reorder_by_similarity(view.scrubbed.item)
      else
        gui.crop_gallery.reorder_by_similarity(view.scrubbed.item)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyL') {
      console.log('Label bee_id in gallery1 using gallery2 selection')
      //console.log(evt)
      if (evt.shiftKey) {
        gui.details.set_bee_ids_from2() // Label all the red selections
      } else {
        gui.details.set_bee_id_from2() // Label the current blue selection
      }
      
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyN') {
      console.log('New bee_id in gallery1')
      //console.log(evt)
      gui.details.set_bee_id_new()
      //gui.details.set_detail2( gui.details.item )
      gui.crop_gallery2.select_item( gui.details.item )
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyT') {
      console.log('Load whole track for current selection')
      //console.log(evt)
      const item = view.scrubbed.item
      console.log(`Loading full track track_key = ${item.track_key} from item`,item)
      view.load_track( gui.get_track_by_key(item.track_key) )
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyR') {
      console.log('Load reference image for each track')
      //console.log(evt)
      view.load_track( gui.get_one_per_track() )
      evt.preventDefault();
      evt.stopPropagation()
    }
  };

  
  select(where, value=true) {
    const view = this

    if (where == 'all') {
      view.selected.forEach( (selected, item) => {view.selected.set(item, value)} )
    } else if (where == 'before') {
      let key = view.scrubbed.order
      let elts = view.gallery.filter(det => det.order <= order)
      elts.forEach( (gallery_item) => gallery_item.selected = value )
    } else if (where == 'after') {
      let key = view.scrubbed.order
      let elts = view.gallery.filter(det => det.order >= order)
      elts.forEach( (gallery_item) => gallery_item.selected = value )
    }
    view.render_selection()
  }
  unselect(where) {
    this.select(where, false)
  }

}

class Scrubber {
  constructor(_config) {
    const scrubber = this
    scrubber.config = {
      parentElement: _config.parentElement,
    }

    makeDispatchable(scrubber, ["gallery-item-scrubbed"])

    scrubber.init()
  }
  init() {
    const scrubber = this
    scrubber.active = false
    scrubber.gallery_track = [];
    
    const div = d3.select(scrubber.config.parentElement)
      .append("div")
      .attr('id','scrub-div')
      .style('height','50px')
      .style('background-color','blue')
      .on('mousemove', evt => scrubber.scrub_mousemove(evt))
      .on('click', evt => scrubber.toggle_scrub('toggle'))
      .html('SCRUB INIT')
    scrubber.div = div

    //scrubber.toggle_scrub(false)
    scrubber.render()
  }
  render() {
    const scrubber = this
    if (scrubber.active) {
      scrubber.div.html(`SCRUB ON - N = ${scrubber.gallery_track.length}`)
        .style('background-color','green')
    } else {
      scrubber.div.html(`SCRUB OFF - Click to activate`)
        .style('background-color','lightgray')
    }
  }
  set_gallery_track(gallery_track) {
    this.gallery_track = gallery_track
    this.render()
  }
  toggle_scrub(_scrub_on = 'toggle') {
    const scrubber = this
    if (_scrub_on == 'toggle')
      scrubber.active = !scrubber.active
    else
      scrubber.active = _scrub_on
    scrubber.render()
  }
  scrub_mousemove(evt) {
    const scrubber = this
    if (!scrubber.active) { // ABORT
      return
    }
    //console.log(`scrub_mousemove`,evt)
  
    const rect = evt.srcElement.getBoundingClientRect();
    const x = evt.clientX - rect.left;
  
    const idx = Math.floor(x / rect.width * scrubber.gallery_track.length)
    const d = scrubber.gallery_track[idx]

    scrubber._emit("gallery-item-scrubbed", d)
  }
}

class FeatureBand {
  constructor(_config) {
    const band = this
    band.config = {
      parentElement: _config.parentElement,
    }

    band.init()
  };
  init() {
    const band = this
    band.visible = false

    band.selected_idx = -1

    band.canvas = d3.select(band.config.parentElement)
      .append("canvas")
      .attr("id","csvCanvas")
      .style('image-rendering','pixelated')
      .style('display',band.visible?'block':'none')
      .style('width','100%')
      .style('height','128px')

      band.gallery_track = []
      d3.csv('/data/reid/batch_1_train_embeddings_26w82ua9.csv')
        .then(function (data) {
          console.log(`features loaded, ${data.length} rows`)
          //band.data = data
          //gtracks.features = data
          
          const featureNames = Array.from({ length: 128 }, (_, i) => `feature_${i}`);
          const rows = data.map(row => featureNames.map(name => parseFloat(row[name])));

          function euclideanNorm(vector) {
            return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
          }
          band.rows = rows.map(row =>
            row.map(value => value / euclideanNorm(row)))

          const flattened = rows.flat();
          let min = d3.min(flattened);
          let max = d3.max(flattened);
          max = Math.max(Math.abs(min),Math.abs(max))
          min = -max

          console.log(`feature normalization: min=${min} max=${max}`)

          const normalizedRows = rows.map(row =>
            row.map(value => Math.round(((value - min) / (max - min)) * 255))
          );
          band.normalizedRows = normalizedRows
          // Normalize the data to the range [0, 255] for pixel intensity
          // const flattened = rows2.flat();
          // const min = d3.min(flattened);
          // const max = d3.max(flattened);
          // const normalizedRows = rows2.map(row =>
          //   row.map(value => Math.round(((value - min) / (max - min)) * 255))
          // );
        })
  };
  update() {
    const band = this

    if (band.visible) {
      //const indices = data.map(row => +row['key']);
    
      const rows2 = band.gallery_track.map(gallery_item => band.normalizedRows[gallery_item.item.key])
      //console.log(rows2)
    
      // Normalize the data to the range [0, 255] for pixel intensity
      // const flattened = rows2.flat();
      // const min = d3.min(flattened);
      // const max = d3.max(flattened);
      // const normalizedRows = rows2.map(row =>
      //   row.map(value => Math.round(((value - min) / (max - min)) * 255))
      // );

      band.display_data = rows2
    }
    band.render()
  };
  render(refresh_features=true) {
    const band = this

    band.canvas.style('display',band.visible?'block':'none')
    if (!band.visible) {
      //console.log('FeatureCanvas not visible, not rendering')
      return
    }

    const canvas = band.canvas.node()
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;

    const display_data = band.display_data
    const height = 128+10+10+10; // Number of features + some indicators
    const width = display_data.length; // Number of rows in the CSV

    let imageData = band.imageData

    if (refresh_features || !band.imageData) {
      //const normalizedRows = band.normalizedRows

      canvas.width = width;
      canvas.height = height;
    
      // Create an ImageData object
      imageData = context.createImageData(width, height);
      band.imageData = imageData
      const pixels = imageData.data;
    
      // Fill the ImageData object with pixel values
      display_data.forEach((row, x) => {
        row.forEach((value, y) => {
          const index = (y * width + x) * 4; // Each pixel has 4 values (RGBA)
          pixels[index] = value; // Red
          pixels[index + 1] = value; // Green
          pixels[index + 2] = value; // Blue
          pixels[index + 3] = 255; // Alpha (fully opaque)
        });
        for (let y=0; y<10; y++) {
          const index = ((y+128) * width + x) * 4; // Each pixel has 4 values (RGBA)
          pixels[index] = (x%2)*255; // Red
          pixels[index + 1] = (Math.floor(x)%2)*255; // Green
          pixels[index + 2] = (Math.floor(x)%2)*255; // Blue
          pixels[index + 3] = 255; // Alpha (fully opaque)
        }
      });

      // SHOW SIMILARITY (FIXME: from crop_gallery directly)
      const sim = gui.crop_gallery.gallery.map( d => d.similarity) // HACK FIXME
      if (sim[0] != undefined) {
        const pixels = imageData.data;
        display_data.forEach((row, x) => {
          let value = Math.max(0, Math.min(1, sim[x]/2+0.5))
          for (let y=0; y<10; y++) {
            const index = ((y+128+20) * width + x) * 4; // Each pixel has 4 values (RGBA)
            pixels[index] = value*255; // Red
            pixels[index + 1] = 0; // Green
            pixels[index + 2] = (1-value)*255; // Blue
            pixels[index + 3] = 255; // Alpha (fully opaque)
          }
        })
      }
    }

    // SHOW SELECTED ID
    //selected_idx = band.selected_idx
    {
      const selected_idx = band.selected_idx
      const pixels = imageData.data;
      for (let x=0; x<display_data.length; x++) {
        let is_selected = (x == selected_idx)
        for (let y=0; y<10; y++) {
          const index = ((y+128+10) * width + x) * 4; // Each pixel has 4 values (RGBA)
          pixels[index] = !is_selected*255; // Red
          pixels[index + 1] = !is_selected*255; // Green
          pixels[index + 2] = 255; // Blue
          pixels[index + 3] = 255; // Alpha (fully opaque)
        }
      }
    }
  
    // Put the ImageData onto the canvas
    context.putImageData(imageData, 0, 0);
  };
  toogle_visibility(toggle='toggle') {
    if (toggle == 'toggle')
      this.visible = !this.visible
    else
      this.visible = !!toggle
    this.update()
  };
  set_gallery_track(gallery_track) {
    this.gallery_track = gallery_track
    this.update()
  };
  select_item(item) {
    this.selected_idx = this.gallery_track.findIndex(d => d.item.key == item.key) // FIXME
    this.render(false)
  };
  compute_similarity(gallery_item, gallery_track) {
    const band = this
    const features = band.rows
    const rows2 = gallery_track.map(gi => features[gi.item.key])
    const row1 = features[gallery_item.item.key]
    //console.log(features)
    //console.log(rows2)
    //console.log(row1)

    const negative_euclidean = (row,x) => {
      let acc = 0
      row.forEach((value, y) => {
        let d = value - row1[y] //(value-127.5) * (row1[y]-127.5) / (127.5 * 127.5)
        acc += d*d
      })
      return -Math.sqrt(acc)
    }
    const correlation = (row,x) => {
      let acc = 0
      row.forEach((value, y) => {
        let d = value * row1[y] //(value-127.5) * (row1[y]-127.5) / (127.5 * 127.5)
        acc += d
      })
      return acc
    }

    const similarities = rows2.map(correlation)
    console.log(similarities)
    return similarities
  };
}

class CropDetails {
  constructor(_config) {
    const details = this
    details.config = {
      parentElement: _config.parentElement,
      gallery: _config.gallery,    // Connect gallery for two-way communication
      gallery2: _config.gallery2,
      //side: _config.side || 'left'
    }
    details.item = undefined;
    details.item2 = undefined;

    makeDispatchable(details, ["bee_id_changed","bee_ids_changed"])

    details.init()
  }

  init() {
    const details = this
    
    details.div = d3.select(details.config.parentElement)
       .append("div")
       .style('display','flex')
       .attr("class","details-container")

    // LEFT DETAILS
    let detail_div = details.div.append("div")
      .attr('id','detail-div')
      .attr('class','detail-div') // Check CSS

    detail_div.append('img')
        .attr('class','detail-image') // Check CSS
        .attr('style', 'width:256px; height:256px;');
    
    detail_div.append('div')
      .attr('id','detail-info')
      .attr('class','detail-info') // Check CSS
      detail_div.select('.detail-info').append('div').attr('class','detail-table')
      detail_div.select('.detail-info').append('div').attr('class','detail-toolbar')

    // Send
    detail_div.select('.detail-toolbar').append("button")
      .text("Set as reference")
      .on('click', function() { details.set_item_gallery2(details.item) })
    detail_div.select('.detail-toolbar').append("button")
      .text("Load whole track")
      .on('click', function() { details.load_whole_track(details.item) })
      detail_div.select('.detail-toolbar').append("button")
        .text("Copy bee_id from right")
        .on('click', function() { details.transfer_bee_id(details.item, details.item2) })

    // RIGHT DETAILS
    let detail_div2 = details.div.append("div")
      .attr('id','detail-div2')
      .attr('class','detail-div')

    detail_div2.append('img')
        .attr('class','detail-image') // Check CSS
        .attr('style', 'width:256px; height:256px;');
    
    detail_div2.append('div')
      .attr('id','detail-info2')
      .attr('class','detail-info') // Check CSS
    detail_div2.select('.detail-info').append('div').attr('class','detail-table')
    detail_div2.select('.detail-info').append('div').attr('class','detail-toolbar')

    detail_div2.select('.detail-toolbar').append("button")
      .text("Load whole track")
      .on('click', function() { details.load_whole_track2(details.item2) })
  }
  render() {
    const details = this

    // DETAIL
    if (details.item) {
      let d = details.item
      details.div.select('#detail-div > img')
        .attr("src",'/data/reid/images/'+d.new_filepath)

      details.div.select('#detail-info > .detail-table')
        .html(`<table>
        <tr><td>bee_id</td><td><input id='bee_id'></input></td></tr>
        <tr><td>color_id</td><td><b>${d.color_id}</b></td></tr>
        <tr><td>key</td><td><b>${d.key}</b></td></tr>
        <tr><td>track_key</td><td><b>${d.track_key}</b></td></tr>
        <tr><td>track_id</td><td><b>${d.track_id}</b></td></tr>
        <tr><td>frame_id</td><td><b>${d.frame_id}</b></td></tr>
        <tr><td>batch</td><td><b>${d.batch}</b></td></tr>
        <tr><td>environment</td><td><b>${d.environment}</b></td></tr>
        <tr><td>bee_range</td><td><b>${d.bee_range}</b></td></tr>
        <tr><td>pass</td><td><b>${d.pass}</b></td></tr>
        <tr><td>background</td><td><b>${d.background}</b></td></tr>
        <tr><td>image</td><td><b>${d.new_filepath}</b></td></tr>
      </table>
          `)
      details.div.select('#bee_id')
        .attr('value', d.bee_id)
        .on('change', (evt)=> details.input_changed_bee_id(evt))
    } else {
      //Empty details
      details.div.select('#detail-div > img')
        .attr("src",'')
      details.div.select('#detail-info > .detail-table')
        .html('No selection')
    }
    // DETAIL2
    if (details.item2) {
      let d = details.item2 || {} // Provide default empty object instead of null to avoid errors
      details.div.select('#detail-div2 > img')
        .attr("src",'/data/reid/images/'+d.new_filepath)

      details.div.select('#detail-info2 > .detail-table')
        .html(`<table>
        <tr><td>bee_id</td><td><b>${d.bee_id}</b></td></tr>
        <tr><td>color_id</td><td><b>${d.color_id}</b></td></tr>
        <tr><td>key</td><td><b>${d.key}</b></td></tr>
        <tr><td>track_key</td><td><b>${d.track_key}</b></td></tr>
        <tr><td>track_id</td><td><b>${d.track_id}</b></td></tr>
        <tr><td>frame_id</td><td><b>${d.frame_id}</b></td></tr>
        <tr><td>batch</td><td><b>${d.batch}</b></td></tr>
        <tr><td>environment</td><td><b>${d.environment}</b></td></tr>
        <tr><td>bee_range</td><td><b>${d.bee_range}</b></td></tr>
        <tr><td>pass</td><td><b>${d.pass}</b></td></tr>
        <tr><td>background</td><td><b>${d.background}</b></td></tr>
        <tr><td>image</td><td><b>${d.new_filepath}</b></td></tr>
      </table>
          `)
    } else {
      //Empty details
      details.div.select('#detail-div2 > img')
        .attr("src",'')
      details.div.select('#detail-info2 > .detail-table')
        .html('No selection')
    }
    
  };
  input_changed_bee_id(evt) {
    console.log('input_changed_bee_id',evt)
    let input = evt.srcElement
    this.set_bee_id(input.value)
  }
  set_bee_id(bee_id, source="manual") { // Set bee_id for detail1
    let item = this.item

    if ((item.bee_id_orig == null) && (item.bee_id != null)) // In case we started with initial ids, keep them as backup
      item.bee_id_orig = item.bee_id // Save original value (but do not overwrite if multiple edits). FIXME: proper undo stack

    item.bee_id = bee_id
    item.bee_id_src = source

    this.div.select('#bee_id')
        .attr('value', bee_id) // Should not trigger change event

    this._emit("bee_id_changed", item) // May trigger change id to the whole track at gui level
  }
  set_bee_id_from2(item2) { // Set bee_id for detail1 current blue selection from detail2
    if (!item2)
      item2 = this.item2

    this.set_bee_id(item2.bee_id, 'from_key='+item2.key)
  }
  set_bee_ids(bee_id, source="manual") { // Set bee_id for detail1 // TODO CLEAN
    const details = this
    const selected_items = gui.crop_gallery.gallery.filter( gallery_item => gallery_item.selected).map( gallery_item => gallery_item.item)
    selected_items.forEach( (item) => {
      if ((item.bee_id_orig == null) && (item.bee_id != null)) // In case we started with initial ids, keep them as backup
      item.bee_id_orig = item.bee_id // Save original value (but do not overwrite if multiple edits). FIXME: proper undo stack

      item.bee_id = bee_id
      item.bee_id_src = source
    })

    this.div.select('#bee_id')
        .attr('value', details.item.bee_id) // Should not trigger change event

    this._emit("bee_ids_changed", selected_items) // May trigger change id to the whole track at gui level
  }
  set_bee_ids_from2(item2) { // Set bee_id for detail1 for current red selection from detail2
    const details = this
    if (!item2)
      item2 = this.item2

    this.set_bee_ids(item2.bee_id, 'from_key='+item2.key)
  }
  set_bee_id_new() { // Set bee_id for detail1 from detail2
    this.set_bee_id(gui.get_bee_id_new())
  }
  set_detail(item) {
    this.item = item
    this.render()
  };
  set_detail2(item) {
    this.item2 = item
    this.render()
  };
  set_item_gallery2(item) {
    this.gallery2.select_item(item)
  }
  load_whole_track(item, append=false) {
    // Send signal to request whole track
    gui.load_track_key(item.track_key, append)
  }
  load_whole_track2(item, append=false) {
    // Send signal to request whole track
    gui.load_track_key2(item.track_key, append)
  }
}

class TrackSplitGUI {
  constructor(_config) {
    console.log("crop_list_view TrackSplitGUI");
    const gui = this
    gui.config = {
      parentElement: _config.parentElement,
    }
    gui.main = d3.select(gui.config.parentElement)
    gui.tracks = _config.tracks

    console.log('TrackSplitGUI tracks=',gui.tracks)

    gui.init()
  }
  init() {
    const gui = this
    const main = gui.main

    main.html('')
    gui.update_visits()
    gui.create_visits_table()

    const gallery_toolbar = main.append('div')
      .attr('class','toolbar')
      .attr('id','gallery_toolbar')
    gallery_toolbar.append("button")
      .text("Load ref crops")
      .on('click', evt => {
          let track = gui.get_one_per_track()
          gui.crop_gallery.load_track(track)
        } )

    gui.crop_gallery = new CropGallery({parentElement: main.node(), showToolbar: false, autoScrollToCenter: true})
    gui.crop_gallery
      .on("item-selected", (item) => {
        gui.details.set_detail(item)
        gui.feature_band.select_item(item)
      } )
      .on("item-unselected", (item) => {
        gui.details.set_detail(null)
        gui.feature_band.select_item(null)
      } )
      .on("gallery-changed", (gallery) => {
        gui.scrubber.set_gallery_track(gallery)
        gui.feature_band.set_gallery_track(gallery)
      } )
    
      
    gui.scrubber = new Scrubber({parentElement: main.node()})
    gui.scrubber.on("gallery-item-scrubbed", 
          function (gallery_item) {
            gui.crop_gallery.select_gallery_item(gallery_item, true)
            gui.details.set_detail(gallery_item.item)
          })

    gui.feature_band = new FeatureBand({parentElement: main.node()})

    const gallery2_toolbar = main.append('div')
        .attr('class','toolbar')
        .attr('id','gallery2_toolbar')
    gallery2_toolbar.append("button")
      .text("Load ref crops")
      .on('click', evt => {
        let track = gui.get_one_per_track()
        gui.crop_gallery2.load_track(track)
      } )

    gui.crop_gallery2 = new CropGallery({parentElement: main.node(), showToolbar: false, autoScrollToCenter: true})
    gui.crop_gallery2.on("item-selected", (item) => gui.details.set_detail2(item) )
      .on("item-unselected", () => { gui.details.set_detail2(null) } )

    gui.details = new CropDetails({parentElement: main.node()})
    gui.details
      .on("bee_id_changed", (item) => {
        gui.propagate_bee_id_to_track(item)
        gui.crop_gallery.update()
        gui.crop_gallery2.update()
      })
      .on("bee_ids_changed", (items) => {
        items.forEach( item => gui.propagate_bee_id_to_track(item))
        gui.crop_gallery.update()
        gui.crop_gallery2.update()
      })
  };
  update_visits() {
    const gui = this
    function agg(g) {
      const item = g[0]
      let start_frame = d3.min(g, d => d.frame_id )
      let end_frame = d3.max(g, d => d.frame_id )
      let nb_samples = g.length
      let span_frames = end_frame-start_frame+1
      let passes = [...new Set(g.map(d => d.pass))]
      const visit = {
        track_key: item['track_key'],
        track_id: item['track_id'],
        background: item['background'],
        color_id: item['color_id'],
        batch: item['batch'],
        passes: passes,
        bee_range: item['bee_range'],
        environment: item['environment'],
        crop_filename: item['new_filepath'],
        video: item['new_filepath'].split('.')[0]+'.mp4',
        start_frame: start_frame,
        end_frame: end_frame,
        span_frames: span_frames,
        nb_samples: nb_samples,
        sampling_ratio: nb_samples / span_frames
      }

      // HACK!!!
      // Plug visit into individual items
      g.forEach(item => {
        item.visit = visit;
      });

      return visit
    }
  
    // CONVERT detailed tracks into high level visits
    const nested = d3.rollup(gui.tracks, agg, d => d.track_key);
    const flat = [];
    for (const [track_key, item] of nested) {
      //console.log(item)
      item['track_key'] = track_key
      flat.push(item);
    }
    gui.visits = flat
  }
  create_visits_table() {
      const gui = this

      // TABLE
      let buttons_div = gui.main
        .append("div")
          .attr('id','buttons-div')
      buttons_div.append("button")
        .text("Hide/Show Table")
        .on('click', () => d3.select("#table-div")
                            .style("display",
                                    () => d3.select("#table-div").style("display") === "none" ? "block" : "none")
            )
      buttons_div.append("button")
        .text("Hide/Show Features")
        .on('click', function () {gui.feature_band.toogle_visibility()})
      
    let top_div = gui.main
      .append('div').attr('id','top-div')

    top_div.append("div")
      .attr('id','table-div')
      .style("max-height","300px")
      .style("overflow-y","scroll")
      .style("overflow-x","scroll")
      .style("width","50%")
    create_table(gui.visits, ['track_key', 'track_id', 'color_id', 'background', 'batch', 'bee_range', 'passes', 'start_frame','end_frame', 'span_frames', 'nb_samples', 'sampling_ratio'], '#table-div')

    gui.main.select('#table-div > table > tbody')
      .selectAll('tr>td.col_track_key')
      .html('')
      .append('a')
        .attr('href','#')
        .text(d => d.track_key)
        .on('click',(evt, d) => gui.load_track_key( d.track_key ))
      // .html(function(d) {
      //   return `<a href="#" onclick="select_track('${d.track_key}')">${d.track_key}</a>`
      // })
  };
  load_track_key(track_key, append=false) {
    const gui = this
    console.log(`load_track_key(${track_key})`)
  
    let track = gui.tracks.filter(det => det.track_key == track_key)
    //gui.track_key = track_key
  
    gui.crop_gallery.load_track(track, append)
  }
  load_track_key2(track_key, append=false) {
    const gui = this
    console.log(`load_track_key(${track_key})`)
  
    let track = gui.tracks.filter(det => det.track_key == track_key)
  
    gui.crop_gallery2.load_track(track, append)
  }
  load_color_id(color_id, append=false) {
    const gui = this
    console.log(`load_color_id(${color_id})`)
  
    let track = gui.tracks.filter(det => det.color_id == color_id)
  
    gui.crop_gallery.load_track(track, append)
  }
  get_track_by_key(track_key) {
    const gui = this
    console.log(`load_track_key(${track_key})`)
  
    let track = gui.tracks.filter(det => det.track_key == track_key)
    return track
  }
  get_one_per_track() {
    function getMiddleDetections(tracks) {
      // Group by track_id using d3.group
      const grouped = d3.group(tracks, d => 'K'+d.color_id+'_'+d.track_id+'_'+d.batch+'_'+d.pass+'_'+d.environment+'_'+d.bee_range+'_'+d.background);
    
      const middle_of_group = (group) => {
            const middleIndex = Math.floor(group.length / 2);
            return group[middleIndex];
          }

      // Get the middle item from each group
      return Array.from(grouped.values(), middle_of_group);
    }
    let track = getMiddleDetections(gui.tracks)
    return track
  }
  get_bee_id_new() {
    const gui = this
    // Get a unique new bee_id
    function getMaxInteger(strings) {
      let max = null;
    
      for (const str of strings) {
        if (/^\d+$/.test(str)) { // match strings that are only digits
          const num = parseInt(str, 10);
          if (max === null || num > max) {
            max = num;
          }
        }
      }
    
      return max;
    }
    function positiveMaxIgnoreNull(a, b) {
      if (a == null) return b;
      if (b == null) return a;
      return Math.max(0,Math.max(a, b));
    }    

    let max = getMaxInteger( gui.tracks.map( d => d.bee_id) )
    let max2 = getMaxInteger( gui.tracks.map( d => d.bee_id_orig) )
    max = positiveMaxIgnoreNull(max,max2)
    const bee_id = String(max+1)
    return bee_id
  }
  propagate_bee_id_to_track(item) {

    function set_bee_id(item, bee_id, source="manual") { // Set bee_id for item
      if ((item.bee_id_orig == null) && (item.bee_id != null)) // In case we started with initial ids, keep them as backup
        item.bee_id_orig = item.bee_id // Save original value (but do not overwrite if multiple edits). FIXME: proper undo stack
      item.bee_id = bee_id
      item.bee_id_src = source
    }

    let track_key = item.track_key
    let bee_id = item.bee_id
    let source = 'track_from_key='+item.key
    gui.tracks.filter( d => d.track_key == track_key).forEach( item =>  set_bee_id(item, bee_id, source))

    this.crop_gallery.update()
    this.crop_gallery2.update()
    this.details.render()
  }
}










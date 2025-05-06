

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

    view.init()
  }

  init() {
    const view = this
    view.scrubbed = undefined
    view.selected = {} // Mapping (item) => bool
    
    const container = d3.select(view.config.parentElement)
      .append('div')
      .attr('class','crop-list-view')
    view.container = container

    /* SELECTION TOOLBAR */
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

    /* EVENT HANDLING */
    const dispatch = d3.dispatch("item-selected","gallery-changed");
    view.dispatch = dispatch
    view.on = function(eventType, callback) {
      view.dispatch.on(eventType, callback)
      return view
    }

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
      view.gallery = view.track.map( (item, index) => ({item:item, selected:false, order:item.new_filepath}) )
    if (mode == 'similarity') {
      view.gallery = view.gallery.map( (gallery_item, index) => ({item:gallery_item.item, selected:false, similarity:similarity[index], order: -similarity[index]}) )
    }
    view.gallery = d3.sort(view.gallery, x => x.order)
    view.update()
    view.select_gallery_item(view.gallery[0])
  }
  reorder_by_similarity(item) {
    let sim = gui.feature_band.compute_similarity({item:item}, this.gallery)
    console.log(sim)
    this.reorder('similarity', sim)
  }
  update() {
    const view = this
    // Rebuld the selection map
    //view.selected = new Map();
    //view.track.forEach( (item) => view.selected.set(item, false) );

    view.gallery = d3.sort(view.gallery, x => x.order)

    view.dispatch.call('gallery-changed', view, view.gallery)

    this.render()
  }
  render() {
    const view = this

    // Add a container for the images in this 'track_key'
    view.track_items.selectAll('.item-container')
    //.data(view.gallery, d=>d.item.new_filepath)
    .data(view.gallery, d=>d.item.key)
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
              .html(`cid <b>${d.item.color_id}</b>
                <br>K<b>${d.item.key}</b> - T<b>${d.item.track_id}</b> F<b>${d.item.frame_id}</b>
                <br>batch <b>${d.item.batch}</b>, bg <b>${d.item.background}</b>
                <br>range <b>${d.item.bee_range}</b>, pass <b>${d.item.pass}</b>
                <br>TC <b>${d.item.visit.nb_samples}</b>
                <br>sim <b>${d.similarity || ''}</b>
                `)    // HACK: d.visit.nb_samples relies on main pluggin the visit into each detection
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

    console.log("select_gallery_item", gallery_item.item.key, gallery_item)

    view.scrubbed = gallery_item
    view.render_selection()

    view.dispatch.call('item-selected', view, gallery_item.item)

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

  onkeypress(evt) {
    const view = this

    console.log('onkeypress:',evt)
    if (evt.srcElement != view.track_items.node()) {
      console.log('MISROUTED EVT:',evt)
      return
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
      gui.crop_gallery.reorder_by_similarity(view.scrubbed.item)
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

    // Event dispatcher
    const dispatch = d3.dispatch("gallery-item-scrubbed");
    scrubber.dispatch = dispatch
    scrubber.on = function(eventType, callback) {
      scrubber.dispatch.on(eventType, callback)
      return scrubber
    }

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

    scrubber.dispatch.call("gallery-item-scrubbed",scrubber,d)
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
  render() {
    const band = this

    band.canvas.style('display',band.visible?'block':'none')
    if (!band.visible) {
      //console.log('FeatureCanvas not visible, not rendering')
      return
    }

    //const normalizedRows = band.normalizedRows
    const display_data = band.display_data

    const canvas = band.canvas.node()
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
  
    const height = 128+10+10+10; // Number of features + some indicators
    const width = display_data.length; // Number of rows in the CSV
    canvas.width = width;
    canvas.height = height;
  
    // Create an ImageData object
    const imageData = context.createImageData(width, height);
    const pixels = imageData.data;
    const sim = gui.crop_gallery.gallery.map( d => d.similarity) // HACK FIXME
  
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
      // SHOW SELECTED ID
      //selected_idx = band.selected_idx
      const selected_idx = band.selected_idx
      let is_selected = (x == selected_idx)
      for (let y=0; y<10; y++) {
        const index = ((y+128+10) * width + x) * 4; // Each pixel has 4 values (RGBA)
        pixels[index] = !is_selected*255; // Red
        pixels[index + 1] = !is_selected*255; // Green
        pixels[index + 2] = 255; // Blue
        pixels[index + 3] = 255; // Alpha (fully opaque)
      }
    });
    // SHOW SIMILARITY (FIXME: from crop_gallery directly)
    if (sim[0] != undefined) {
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
    this.render()
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
    }
    // DETAIL2
    if (details.item2) {
      let d = details.item2
      details.div.select('#detail-div2 > img')
        .attr("src",'/data/reid/images/'+d.new_filepath)

      details.div.select('#detail-info2 > .detail-table')
        .html(`<table>
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
    }
    
  };
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

    gui.crop_gallery = new CropGallery({parentElement: main.node(), showToolbar: false, autoScrollToCenter: true})
    gui.crop_gallery.on("item-selected", (item) => {
        gui.details.set_detail(item)
        gui.feature_band.select_item(item)
      } )
    gui.crop_gallery.on("gallery-changed", (gallery) => {
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

    gui.details = new CropDetails({parentElement: main.node()})

    const gallery2_toolbar = main.append('div')
        .attr('class','toolbar')
        .attr('id','gallery2_toolbar')
    gallery2_toolbar.append("button")
      .text("Load ref crops")
      .on('click', evt => gui.load_one_per_track() )

    gui.crop_gallery2 = new CropGallery({parentElement: main.node(), showToolbar: false, autoScrollToCenter: true})
    gui.crop_gallery2.on("item-selected", (item) => gui.details.set_detail2(item) )
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
  load_one_per_track() {
    let track = this.get_one_per_track()
    gui.crop_gallery2.load_track(track)
  }
}










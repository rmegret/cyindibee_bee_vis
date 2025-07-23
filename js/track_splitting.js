

var gtracks = {}
var scrub_on = false
var show_features = false
var gui

// Require confirmation to leave page
window.addEventListener("beforeunload", (event) => {
  event.preventDefault(); // Required for some browsers
  event.returnValue = ""; // Trigger confirmation dialog
});

// Main function to launch the GUI
async function show_track_util() {
  console.log('show_track_util')

  const main = d3.select('#main')

  gui = new TrackSplitGUI({parentElement: main.node(),
                           tracks: []
                          })
  
  //gui.load_csv('/data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv')
  //gui.load_csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch2_sample_num_max.csv')
  //gui.feature_band.load_features('/data/reid/batch_1_train_embeddings_26w82ua9.csv')

  gui.load_dataset_json('/data/flowerpatch/flowerpatch_20240606_11h04.dataset_single_crop.json')
  //gui.load_dataset_json('/data/reid/reid.crops_dataset.json')
}


function joinPaths(a, b) {
  if (a.endsWith('/')) a = a.slice(0, -1);
  if (b.startsWith('/')) b = b.slice(1);
  return a + '/' + b;
}

function categories_to_indices(data, category_field, index_field) {
  // Create a field `index_field` out of `category_field` in the table data
  // Returns the mapping
  const categories = Array.from(new Set(data.map(d => d[category_field])));
  const catToId = new Map(categories.map((name, i) => [name, i+1])); // Avoid id=0, keep it for undefined
  data.forEach(d => d[index_field] = catToId.get(d[category_field]));
  return catToId
}
function drop_columns(data, fields) {
  data.forEach(d => {fields.forEach(f => delete d[f])});
}
function new_column(data, output_field, fun) {
  data.forEach(d => d[output_field] = fun(d));
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
  //target.scrollIntoView({ behavior: "instant", block: "center", inline: "center" })
}
throttledScrollToCenter = throttleTrailing(scrollToCenter, 100)


class LoadDataDialog {
  // Generic
  constructor(title = 'Data Dialog') {
    const dialog = this
    if (this.node) return; // already initialized

    this.node = document.createElement('dialog');
    this.node.classList.add('fullscreen');
    this.node.setAttribute('id','dialog')
    document.body.appendChild(this.node);

    this.dialogD3 = d3.select(this.node)

    this.title = title
    this.dataset_root = '/data/'
    this.config = {}
    this.config.max_depth = 2

    this.init()
  }
  open(root) {
    if (root)
      this.dataset_root = root
    this.update()
    this.node.showModal();
  }
  close() {
    if (this.node) {
      this.node.close();
    }
  }

  // Specific
  init() {
    const dialog = this
    this.node.innerHTML = `
      <div id="dialog-header" class='flex-container'>
        <div class='flex'><h2 id="dialog-title"></h2></div>
        <button id="dialog-close" class='flex-left'>Close</button>
      </div>
      <div id="dialog-toolbar" class='flex-container'>
        <select id="selector"></select>
        <button id="loadButton">Load</button>
      </div>
      <div id="dialog-content">
        <pre id="csvOutput"></pre>
        <pre id="csvOutputDebug"></pre>
      </div>
    `;
    this.node.querySelector('#dialog-title').innerText = this.title;
    //this.node.querySelector('#dialog-content').innerHTML = 'INIT';
    this.node.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
    this.node.querySelector('#loadButton').addEventListener('click', () => dialog.load_button_click());
    this.contentD3 = d3.select(this.node.querySelector('#dialog-content'))

    this.selector = this.node.querySelector('#selector');
    this.output = this.node.querySelector('#csvOutput');
    this.outputDebug = this.node.querySelector('#csvOutputDebug');
  }
  update() {
    const dialog = this

    console.log('update')

    const selector = dialog.selector
    const output = dialog.output

    selector.innerHTML = '';

    const dataset_root = dialog.dataset_root

    const P = (async () => {
      // Search in 'datasets/' directory
      //dialog.outputDebug.textContent = `Looking for CSV files in ${dataset_root}`
      //const files = await dialog.findCSVFiles(dataset_root);
      dialog.outputDebug.textContent = `Looking for JSON files in ${dataset_root}`
      const files = await dialog.findJSONFiles(dataset_root);

      files.forEach(path => {
          const option = document.createElement('option');
          option.value = path;
          option.textContent = path;
          selector.appendChild(option);
      });

      selector.addEventListener('change', async () => {
          const selected = selector.value;
          const textContent = await fetch(selected).then(res => res.text());
          output.textContent = textContent;
      });
    })().then(() => console.log('LOADING DONE'))
    
  };
  load_button_click() {
    const file_path = this.selector.value;
    //gui.load_csv(file_path)
    gui.load_dataset_json(file_path)
    this.close()
  }
  async fetchAndParseDirectory(url) {
    const html = await fetch(url).then(res => res.text());
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a'))
        .map(a => a.getAttribute('href'))
        .filter(href => href && !href.startsWith('?') && href !== '../');
    return links;
  }

  async findCSVFiles(basePath, patternFn = path => path.endsWith('.csv')) {
      const dialog = this
      const queue = [basePath];
      const csvPaths = [];

      while (queue.length > 0) {
          const current = queue.pop();
          const fullUrl = new URL(current, window.location.origin).href;
          
          dialog.outputDebug.textContent += `\nVisiting ${fullUrl}`;

          const entries = await this.fetchAndParseDirectory(fullUrl);

          for (const entry of entries) {
              const fullPath = current + entry;
              if (entry.endsWith('/')) {
                  // It's a subdirectory
                  queue.push(fullPath);
              } else if (patternFn(fullPath)) {
                  csvPaths.push(fullPath);
              }
          }
      }

      return csvPaths;
  }
  async findJSONFiles(basePath, patternFn = path => path.endsWith('.json')) {
      const dialog = this
      const queue = [[basePath,0]];
      const paths = [];

      while (queue.length > 0) {
          const [current,depth] = queue.pop();
          const fullUrl = new URL(current, window.location.origin).href;
          
          dialog.outputDebug.textContent += `\nVisiting ${fullUrl}`;

          const entries = await this.fetchAndParseDirectory(fullUrl);

          for (const entry of entries) {
              const fullPath = current + entry;
              if (entry.endsWith('/')) {
                  // It's a subdirectory
                  if (depth<dialog.config.max_depth) {
                    queue.push([fullPath,depth+1]);
                  }
              } else if (patternFn(fullPath)) {
                  paths.push(fullPath);
              }
          }
      }

      return paths;
  }
}

class TableDialog {
  // Generic
  constructor(title = 'Table Dialog') {
    const dialog = this
    if (this.node) return; // already initialized

    this.node = document.createElement('dialog');
    this.node.classList.add('fullscreen');
    this.node.setAttribute('id','dialog')
    this.node.innerHTML = `
      <div id="dialog-header" class='flex-container'>
        <div class='flex'><h2 id="dialog-title"></h2></div>
        <button id="dialog-close" class='flex-left'>Close</button>
      </div>
      <div id="dialog-toolbar">
        Group by:
        <button id="button_groupby_track_key">track_key</button>
        <button id="button_groupby_bee_id">bee_id</button>
      </div>
      <div id="dialog-content"></div>
    `;
    document.body.appendChild(this.node);

    this.dialogD3 = d3.select(this.node)

    this.node.querySelector('#dialog-title').innerText = title;
    this.node.querySelector('#dialog-content').innerHTML = 'INIT';
    this.node.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
    this.dialogD3.select('#button_groupby_track_key').on('click', () => {dialog.aggMode='track_key'; dialog.update()})
    this.dialogD3.select('#button_groupby_bee_id').on('click', () => {dialog.aggMode='bee_id'; dialog.update()})
    this.contentD3 = d3.select(this.node.querySelector('#dialog-content'))

    this.aggMode = 'track_key'
  }
  open() {
    this.update()
    this.node.showModal();
  }
  close() {
    if (this.node) {
      this.node.close();
    }
  }

  // Specific
  update() {
    const that = this

    console.log('update')

    that.update_visits()
    that.render()  // create table
  }
  update_visits() {
    const dialog = this
    if (dialog.aggMode == 'track_key')
      dialog.update_visits_track_key()
    else if (dialog.aggMode == 'bee_id')
      dialog.update_visits_bee_id()
    else 
      console.log('update_visits: unrecognized aggMode:', dialog.aggMode)
  }
  update_visits_track_key() {
    const dialog = this

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
  
    const tracks = gui.tracks // HACK

    // CONVERT detailed tracks into high level visits
    const nested = d3.rollup(tracks, agg, d => d.track_key);
    const flat = [];
    for (const [track_key, item] of nested) {
      //console.log(item)
      item['track_key'] = track_key
      flat.push(item);
    }
    dialog.visits = flat
  }
  update_visits_bee_id() {
    const dialog = this

    function agg(g) {
      const item = g[0]
      let nb_tracks = [...new Set(g.map(d => d.track_key))].length
      let nb_samples = g.length
      const visit = {
        bee_id: item['bee_id'],
        nb_tracks: nb_tracks,
        nb_samples: nb_samples,
        color_ids: [...new Set(g.map(d => d.color_id))],
        track_keys: [...new Set(g.map(d => d.track_key))],
        backgrounds: [...new Set(g.map(d => d.background))],
        environments: [...new Set(g.map(d => d.environment))],
        videos_keys: [...new Set(g.map(d => d.video_key))],
      }
      return visit
    }
  
    const tracks = gui.tracks // HACK

    // CONVERT detailed tracks into high level visits
    const nested = d3.rollup(tracks, agg, d => d.bee_id);
    const flat = [];
    for (const [bee_id, item] of nested) {
      //console.log(item)
      item['bee_id'] = bee_id
      flat.push(item);
    }
    dialog.bees = flat
  }
  render() {
    const dialog = this

    const parent = dialog.contentD3

    // TABLE
    parent.html('')
    let top_div = parent
      .append('div').attr('id','top-div')

    if (dialog.aggMode == "track_key") { 
      // ### GROUP BY TRACK_KEY
      console.log('aggMode track_key from ',dialog.visits)
      top_div.append("div")
        .attr('id','table-div')
      create_table(dialog.visits, ['track_key', 'color_id', 'background', 'batch', 'bee_range', 'passes', 'start_frame','end_frame', 'span_frames', 'nb_samples', 'sampling_ratio'], '#table-div')

      parent.select('#table-div > table > tbody')
        .selectAll('tr>td.col_track_key')
        .html('')
        .append('a')
          .attr('href','#')
          .text(d => d.track_key)
          .on('click',(evt, d) => {
                gui.crop_gallery.load_track( gui.get_track_by_key( d.track_key ) )
                dialog.close()
              })
    } else {  
      // ### GROUP BY BEE_ID
      console.log('aggMode not track_key: bee_id, from ',dialog.bees)
      top_div.append("div")
        .attr('id','table-div')
      create_table(dialog.bees, ['bee_id', 'nb_tracks', 'nb_samples', 'environments', 'backgrounds'], '#table-div')

      parent.select('#table-div > table > tbody')
        .selectAll('tr>td.col_bee_id')
        .html('')
        .append('a')
          .attr('href','#')
          .text(d => d.bee_id)
          .on('click',(evt, d) => {
                gui.crop_gallery.load_track( gui.get_track_by_bee_id( d.bee_id ) )
                dialog.close()
              })
    }
  };
}

class Popup {
  constructor() {
    const node = d3.select('body').append('div')
            .attr('id','popup')
            .style('position','absolute')
            .style('display','none')
            .style('background','white')
            .style('border','1px solid #ccc')
            .style('box-shadow','0 2px 6px rgba(0,0,0,0.2)')
            .style('z-index',1000)
            .node() //.getElementById('popup');
    this.node = node
    document.body.appendChild(this.node);
    document.addEventListener('click', (e) => {
      if (!node.contains(e.target)) {//) && !trigger.contains(e.target)) {
        this.close()
      }
    });
  }
  register(trigger, menu, select_cb) {
    const node = this.node
    // Show popup on trigger click
    const click_cb = trigger.addEventListener('click', (evt) => {
      console.log("Popup triggered:", trigger, menu);
      
      evt.preventDefault()
      evt.stopPropagation()

      // Position the popup near the trigger
      const rect = trigger.getBoundingClientRect();
      node.style.left = (rect.left + window.scrollX) + 'px';
      node.style.top = (rect.bottom + window.scrollY) + 'px';
      node.style.display = 'block';

      // Clear and populate popup
      node.innerHTML = '';
      menu.forEach( (item, idx) => {
        const el = document.createElement('div');
        el.textContent = item;
        el.index = idx
        el.style.padding = '6px 12px';
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          node.style.display = 'none';
          console.log("Selected:", idx, item);
          select_cb(item, idx);
        });
        el.addEventListener('mouseenter', () => el.style.background = '#eee');
        el.addEventListener('mouseleave', () => el.style.background = 'white');
        node.appendChild(el);
      });
    });

    trigger._popup_menu = menu
    trigger._popup_click_cb = click_cb
    trigger._popup_select_cb = select_cb
  }
  deregister(trigger) {
    trigger.removeEventListener('click', trigger._popup_click_cb);
  }
  close() {
    console.log("Popup closed");
    this.node.style.display = 'none';
  }
}

function ensureTrailingSlash(path) {
  return path.endsWith('/') ? path : path + '/';
}

class CropGallery {
  constructor(_config) {
    const view = this
    view.config = {
      parentElement: _config.parentElement,
      showToolbar: _config.showToolbar,
      autoScrollToCenter: _config.autoScrollToCenter,
      expand: _config.expand == null ? true : _config.expand,
      // containerWidth: 1100,
      // containerHeight: 800,
      // tooltipPadding: 15,
      // margin: {top: 60, right: 20, bottom: 20, left: 45},
      // legendWidth: 160,
      // legendBarHeight: 10
    }
    view.imagedir = ensureTrailingSlash( _config.imagedir || '/data/reid/images/' )
    view.track = [];
    view.gallery0 = [];
    view.filter = null
    //view.collapse = null
    view.dataset_query = {
          scope: {},  // {label:'track_key',value:34} or {label:'bee_id',value:17}
          filter_ref: {label:'track_key'},  // or 'bee_id' or {}
          filter_label: {},  // {label:'bee_id',value:true} or {label:'bee_id',value:false}
          filter_ignore: false,
          order: {by:['bee_id','track_key','frame_id'],asc:[true,true,true]}, 
          // or {by:['bee_id','track_key','frame_id'],asc:true} or {by:['similarity'],asc:false,ref_item:item}
          limit: 1000, // max number of samples
        }

    view.scrubbed = undefined
    //view.selected = {} // Mapping (item) => bool
    view.nb_selected = 0

    makeDispatchable(view, ["item-selected","item-unselected","gallery-changed"])

    view.popup = new Popup()

    view.init()
  }

  node() {
    return this.container.node()
  }
  expand(state='toggle') {
    if (state == 'toggle') {
      this.config.expand = !this.config.expand
    } else {
      this.config.expand = !!state
    }
    this.track_items
         .classed('expand', this.config.expand)
  }

  set_imagedir(imagedir) {
    this.imagedir = ensureTrailingSlash( imagedir || '/data/reid/images/' )
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
    // buttons_div_filter.append("button").text("Filter ALL")
    //       .on('click', () => view.set_filter(null))
    // buttons_div_filter.append("button").text("Filter HAS BEE_ID")
    //     .on('click', () => view.set_filter('bee_id', true))
    // buttons_div_filter.append("button").text("Filter NO BEE_ID")
    //     .on('click', () => view.set_filter('bee_id', false))
    buttons_div_filter.append("span").html('<b>Mode: </b>')
    buttons_div_filter.append("button").text("Unlabeled tracks")
         .on('click', () => view.set_mode('unlabeled_tracks'))
    buttons_div_filter.append("button").text("Labeled IDs")
         .on('click', () => view.set_mode('labeled_bee_ids'))
    buttons_div_filter.append("button").text("Current Track [t]")
         .on('click', () => view.set_mode('current_track'))
    buttons_div_filter.append("button").text("Current bee_id [b]")
         .on('click', () => view.set_mode('current_bee_id'))
    buttons_div_filter.append("button").text("Ignored tracks")
         .on('click', () => view.set_mode('ignored_tracks'))

    const select_button = buttons_div_filter.append("button").text("Select...").attr('id','select-button')
    view.popup.register(select_button.node(), 
        ['Select after','Unselect after','Select before','Unselect before','Select All','Unselect All','Invert Selection'], 
        (item,idx) => {
          console.log(item,idx)
          if (idx==0) view.select('after', true)
          if (idx==1) view.select('after', false)
          if (idx==2) view.select('before', true)
          if (idx==3) view.select('before', false)
          if (idx==4) view.select('all', true)
          if (idx==5) view.select('all', false)
          if (idx==6) view.select('invert')
          //view.update()
        })


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


    const dataset_div = container.append("div")
        .attr('class','dataset-div flex-container')
    view.dataset_div = dataset_div

    /* GALLERY TRACK VIEW */
    const track_div = container.append("div")
      .attr('class','track-div')
    view.track_div = track_div

    const track_items = view.track_div.append('div')
      .attr('class', 'track-items')
    view.track_items = track_items

    track_items.on('keydown', (evt) => view.onkeypress(evt))
        .attr("tabindex", "1")

    
    
    const status_div = container.append("div")
        .attr('class','buttons-div flex-container')
        .attr('id','status_bar')
    view.status_div = status_div

    console.log("crop_list_view initialized");
  }

  set_mode(mode) {
    if (mode == 'current_track') {
      this.dataset_query.filter_ignore = false
      this.click_load_selected_track()
    } else if (mode == 'current_bee_id') {
      this.dataset_query.filter_ignore = false
      this.click_load_selected_bee_id({shiftKey:false})
    } else if (mode == 'unlabeled_tracks') {
      this.dataset_query.scope = {}
      this.dataset_query.filter_ref = {label:'track_key',value:true}
      this.dataset_query.filter_label = {label:'bee_id',value:false}
      this.dataset_query.filter_ignore = false
      //this.refresh_dataset_buttons()
      this.update()
    } else if (mode == 'labeled_bee_ids') {
      this.dataset_query.scope = {}
      this.dataset_query.filter_ref = {label:'bee_id',value:true}
      this.dataset_query.filter_label = {label:'bee_id',value:true}
      this.dataset_query.filter_ignore = false
      this.update()
    } else if (mode == 'ignored_tracks') {
      this.dataset_query.scope = {}
      this.dataset_query.filter_ref = {label:'track_key',value:true}
      this.dataset_query.filter_label = {label:null}
      this.dataset_query.filter_ignore = true
      this.update()
    } else {
      console.log('set_mode: unrecognized mode:', mode)
    }
  }

  refresh_dataset_buttons() {
    const view = this
    const dataset_div = view.dataset_div
    const dataset_query = view.dataset_query

    dataset_div.html('')

    if (dataset_query.scope.label == 'track_key') {
      dataset_div.append('div').attr('class','dataset-button button-scope').html('track_key='+dataset_query.scope.value)
    } else if (dataset_query.scope.label == 'bee_id') {
      dataset_div.append('div').attr('class','dataset-button button-scope').html('bee_id='+dataset_query.scope.value)
    } else {
      dataset_div.append('div').attr('class','dataset-button button-scope').html('Whole dataset')
    }
    view.popup.register(dataset_div.select('.button-scope').node(), 
        ['Whole dataset','Select track_key','Select bee_id'], 
        (item,idx) => {
          console.log(item,idx)
          if (item=='Whole dataset') dataset_query.scope={}
          if (item=='Select track_key') {
            const value = prompt("Enter a track_key:");
            console.log(value)
            if (value == null) return;
            view.dataset_query.scope={label:'track_key',value:Number(value)}
          }
          if (item=='Select bee_id') {
            const value = prompt("Enter a bee_id:");
            console.log(value)
            if (value == null) return;
            view.dataset_query.scope={label:'bee_id',value:Number(value)}
          }
          view.refresh_dataset_buttons()
          view.update()
        })
    //dataset_div.select('.button-scope').on('click')

    if (dataset_query.filter_ref.label == 'track_key') {
      dataset_div.append('div').attr('class','dataset-button button-filter-ref').html('Only track reference ↝')
    } else if (dataset_query.filter_ref.label == 'bee_id') {
      dataset_div.append('div').attr('class','dataset-button button-filter-ref').html('Only bee_id reference 👤')
    } else {
      dataset_div.append('div').attr('class','dataset-button button-filter-ref').html('All frames')
    }
    view.popup.register(dataset_div.select('.button-filter-ref').node(), 
        ['All frames','Only track ref ↝','Only bee_id ref 👤'], 
        (item,idx) => {
          console.log(item,idx)
          if (idx == 0) dataset_query.filter_ref={label:null}
          if (idx == 1) {
            view.dataset_query.filter_ref={label:'track_key',value:true}
          }
          if (idx == 2) {
            view.dataset_query.filter_ref={label:'bee_id',value:true}
          }
          view.refresh_dataset_buttons()
          view.update()
        })
    //dataset_div.select('.button-scope').on('click')

    if (dataset_query.filter_label.label == null) {
      dataset_div.append('div').attr('class','dataset-button button-filter-label').html('All labels')
    } else if (dataset_query.filter_label.label == 'bee_id') {
      if (dataset_query.filter_label.value) {
        dataset_div.append('div').attr('class','dataset-button button-filter-label').html('Has bee_id ✅')
      } else {
        dataset_div.append('div').attr('class','dataset-button button-filter-label').html('No bee_id 🚫')
      }
    } else if (dataset_query.filter_label.label == 'custom') {
        dataset_div.append('div').attr('class','dataset-button button-filter-label').html('Custom')
    }
    view.popup.register(dataset_div.select('.button-filter-label').node(), 
        ['All labels','Has bee_id ✅','No bee_id 🚫','Custom'], 
        (item,idx) => {
          console.log(item,idx)
          if (idx==0) dataset_query.filter_label={}
          if (idx==1) {
            view.dataset_query.filter_label={label:'bee_id',value:true}
          }
          if (idx==2) {
            view.dataset_query.filter_label={label:'bee_id',value:false}
          }
          if (idx==3) {
            let custom_filter_code = "true"
            if (dataset_query.filter_label.label == 'bee_id') {
              custom_filter_code = `(d.bee_id ${dataset_query.filter_label.value ? "!=" : "=="} null)`
            } else if (dataset_query.filter_label.label == 'custom') {
              custom_filter_code = dataset_query.filter_label.custom_filter_code
            }
            let custom_filter = null
            while (true) {
              custom_filter_code = prompt("Enter a custom filter (e.g. d.bee_id!=null):", custom_filter_code);
              if (custom_filter_code == null) break;
              console.log("custom_filter_code=",custom_filter_code)
              try {
                custom_filter = new Function('d,g', `return ${custom_filter_code}`);
                console.log("custom_filter=",custom_filter)
                break;
              } catch (e) { 
                console.log("Error in custom filter code:", e)
                alert("Error in custom filter code: "+e)
              }
            }
            console.log("custom_filter=",custom_filter)
            if (custom_filter)
              view.dataset_query.filter_label={label:'custom',value:custom_filter, custom_filter_code:custom_filter_code}
          }
          view.refresh_dataset_buttons()
          view.update()
        })

    if (dataset_query.filter_ignore == null) {
      dataset_div.append('div').attr('class','dataset-button button-filter-ignore').html('Keep ignored')
    } else if (dataset_query.filter_ignore == true) {
      dataset_div.append('div').attr('class','dataset-button button-filter-ignore').html('Only ignored')
    } else {
      dataset_div.append('div').attr('class','dataset-button button-filter-ignore').html('Drop ignored')
    }
    view.popup.register(dataset_div.select('.button-filter-ignore').node(), 
        ['Keep ignored','Only ignored','Drop ignored'], 
        (item,idx) => {
          console.log(item,idx)
          if (idx==0) dataset_query.filter_ignore=null
          if (idx==1) dataset_query.filter_ignore=true
          if (idx==2) dataset_query.filter_ignore=false
          view.update()
        })

    function get_order_string() {
      let asc = dataset_query.order.asc
      // if (!Array.isArray(asc)) {
      //   asc = dataset_query.order.by.map( d => asc ) // Duplicate to fit order length
      // }
      let order_string = dataset_query.order.by.map( (d,i) => d+(asc[i]?'⇧':'⇩') ).join('/')
      return order_string
    }
    let order_string = "Unknown"
    if ( Array.isArray(dataset_query.order.by) ) {
      order_string = get_order_string()
      dataset_div.append('div').attr('class','dataset-button button-order')
          .html('Order...')
    }
    view.popup.register(dataset_div.select('.button-order').node(), 
        ['Refresh: '+order_string,'Default','Similarity','Custom Order'], 
        (item,idx) => {
          console.log(item,idx)
          if (idx==0) view.reorder()
          if (idx==1) {
            view.dataset_query.order = {by:['bee_id','track_key','frame_id'],asc:[true,true,true]}
            view.reorder()
          }
          if (idx==2) {
            view.dataset_query.order = {by:['similarity'],asc:[true]}
            view.reorder()
          }
          if (idx==3) {
            let custom_order = null
            let custom_order_json = JSON.stringify(view.dataset_query.order)
            while (true) {
              custom_order_json = prompt("Enter a custom order (e.g. {by:['track_key'],asc:[true]}):", custom_order_json);
              if (custom_order_json == null) break;
              console.log("custom_order_json=",custom_order_json)
              try {
                custom_order = JSON.parse(custom_order_json)
                console.log("custom_order=",custom_order)
                break;
              } catch (e) {
                console.log("Error in custom order config:", e)
                alert("Error in custom order config: "+e)
              }
            }
            if (custom_order) {
              view.dataset_query.order=custom_order
              view.reorder()
            }
          }
          //view.refresh_dataset_buttons()
          //view.update()
        })

    dataset_div.append('div')
      .attr('class','dataset-button button-limit')
      .html('limit='+dataset_query.limit)
      .on('click', () => {
        const value = prompt("Enter a limit (0=nolimit):");
        console.log(value)
        if (value == null) return;
        if (value == 0) {
          view.dataset_query.limit = 'nolimit'
        } else {
          view.dataset_query.limit = Number(value)
        }
        view.refresh_dataset_buttons()
        view.update()
      })
  }
  load_track(track, append=false) {
    if (append)
      this.track.push(...track)
    else
      this.track = track
    this.reorder()
    this.update()
  }
  reorder() {
    const view = this

    function sortByKeys(keys, ascs) {
      const zipped = keys.map((val, i) => [val, ascs[i]]);
      return (a, b) => {
        for (const [key,asc] of zipped) {
          const va = a.item[key]
          const vb = b.item[key]
          if ((va==null) && (vb==null)) continue;
          if (asc) {
            if ((va==null) && (vb!=null)) return -1; // a-b, null before the rest in asc
            if ((va!=null) && (vb==null)) return 1; // a-b, null before the rest in asc
            const cmp = d3.ascending(va, vb);
            if (cmp !== 0) return cmp;
          } else {
            if ((va==null) && (vb!=null)) return 1; // a-b, null before the rest in asc
            if ((va!=null) && (vb==null)) return -1; // a-b, null before the rest in asc
            const cmp = d3.descending(va, vb);
            if (cmp !== 0) return cmp;
          }
        }
        return 0;
      };
    }

    if (view.dataset_query.order.by[0] == 'similarity') {
      // DONE, need to recompute sim to reorder this
    } else {
      view.gallery0 = view.track.map( (item, index) => ({item:item, selected:false, order:index}) )
      view.gallery0 = d3.sort(view.gallery0, sortByKeys(view.dataset_query.order.by, view.dataset_query.order.asc))
      view.gallery0.forEach( (gallery_item, index) => {gallery_item.order=index} )
      //view.dataset_query.order = {by:['bee_id','track_key','frame_id'],asc:[true,true,true]}
    }
    
    view.update()
    //view.select_gallery_item(view.gallery[0])
  }
  reorder_by_similarity(item) {
    const view = this
    let sim = gui.feature_band.compute_similarity({item:item}, this.gallery0)
    console.log(sim)
    view.gallery0 = view.gallery0.map( (gallery_item, index) => ({item:gallery_item.item, selected:false, similarity:sim[index], order: index}) )
    view.gallery0 = d3.sort(view.gallery0, x => -x.similarity)
    view.gallery0.forEach( (gallery_item, index) => {gallery_item.order=index} )
    view.dataset_query.order = {by:['similarity'],asc:[false]}
    this.reorder()
  }
  update() {
    const view = this
    // Rebuld the selection map
    //view.selected = new Map();
    //view.track.forEach( (item) => view.selected.set(item, false) );
    
    // Pipeline: gallery0 => filter => sort => gallery
    
    this.refresh_dataset_buttons()

    let tmp_gallery = view.gallery0

    // view.dataset_query = {
    //       scope: {},  // {label:'track_key',value:34} or {label:'bee_id',value:17}
    //       filter_ref: {label:'track_key'},  // or 'bee_id' or {}
    //       filter_label: {},  // {label:'bee_id',value:true} or {label:'bee_id',value:false}
    //       order: {by:['track_key','frame_id'],asc:true}, 
    //       // or {by:['bee_id','track_key','frame_id'],asc:true} or {by:['similarity'],asc:false,ref_item:item}
    //       limit: 'nolimit', // max number of samples
    //     }

    const query = view.dataset_query

    // SCOPE
    const scope = query.scope
    let scope_filter = (gi) => true
    if (scope.label == 'track_key') {
      //console.log(`scope track_key=${scope.value}`)
      scope_filter = (gi) => gi.item.track_key == scope.value
      tmp_gallery = tmp_gallery.filter( scope_filter )
    } else if (scope.label == 'bee_id') {
      //console.log(`scope bee_id=${scope.value}`)
      scope_filter = (gi) => gi.item.bee_id == scope.value
      tmp_gallery = tmp_gallery.filter( scope_filter )
    } else if (scope.label == null) {
      //console.log(`scope all`)
    } else {
      console.log(`dataset_query scope unrecognized: ${scope}`)
    }

    // IS REF
    const ref = query.filter_ref
    let ref_filter = (gi) => true
    if (ref.label == 'track_key') {
      //console.log(`ref track_key`)
      ref_filter = (gi) => gi.item.is_track_ref
      tmp_gallery = tmp_gallery.filter( ref_filter )
    } else if (ref.label == 'bee_id') {
      //console.log(`ref bee_id`)
      ref_filter = (gi) => gi.item.is_bee_id_ref
      tmp_gallery = tmp_gallery.filter( ref_filter )
    } else if (ref.label == null) {
      //console.log(`ref all`)
    } else {
      console.log(`dataset_query filter_ref unrecognized: ${ref}`)
    }
    
    // HAS LABEL
    const label = query.filter_label
    let label_filter = (gi) => true
    if ((label.label == 'bee_id') && (label.value)) {
      //console.log(`has bee_id label: ${label.value}`)
      label_filter = (gi) => gi.item.bee_id != null
      tmp_gallery = tmp_gallery.filter( label_filter )
    } else if ((label.label == 'bee_id')  && (!label.value)) {
      //console.log(`no bee_id label: ${label.value}`)
      label_filter = (gi) => gi.item.bee_id == null
      tmp_gallery = tmp_gallery.filter( label_filter )
    } else if (label.label == 'custom') {
      const custom_filter = label.value
      tmp_gallery = tmp_gallery.filter( (gi) => custom_filter(gi.item, gi) )
    } else if (label.label == null) {
      console.log(`label all`)
    } else {
      console.log(`dataset_query filter_label unrecognized: ${label}`)
    }

    // IGNORE
    if (query.filter_ignore == true) {
      tmp_gallery = tmp_gallery.filter( (gi) => gi.item.ignore==true )
    } else if (query.filter_ignore == false) {
      tmp_gallery = tmp_gallery.filter( (gi) => gi.item.ignore!=true ) // To accept null
    } else {
    }

    // if (view.filter != null) {
    //   let field = view.filter.field
    //   let flag = view.filter.flag
    //   tmp_gallery = tmp_gallery.filter(  d => !!d.item[field] == flag )
    // }

    // ORDER 
    //tmp_gallery = d3.sort(tmp_gallery, x => x.order)  // Suposed to be already sorted

    // LIMIT
    if (query.limit != 'nolimit') {
      tmp_gallery = tmp_gallery.slice(0, Math.min(query.limit, tmp_gallery.length))
    }

    view.gallery = tmp_gallery


    function isNewTrack(previousGalleryItem, galleryItem) {
      //console.log('isNewTrack',previousGalleryItem, galleryItem)
      if (!previousGalleryItem) {
        //console.log('!previousGalleryItem')
        galleryItem.firstOfTrack = true
      } else {
        //console.log('previousGalleryItem')
        galleryItem.firstOfTrack = (galleryItem.item.track_key != previousGalleryItem.item.track_key)
      }
      return galleryItem
    }
    view.gallery.reduce( isNewTrack, null ) // Annotate each item with galleryItem.firstOfTrack==true if first item of a track

    function isNewBeeId(previousGalleryItem, galleryItem) {
      //console.log('isNewTrack',previousGalleryItem, galleryItem)
      if (!previousGalleryItem) {
        //console.log('!previousGalleryItem')
        galleryItem.firstOfBeeId = true
      } else {
        //console.log('previousGalleryItem')
        galleryItem.firstOfBeeId = (galleryItem.item.bee_id != previousGalleryItem.item.bee_id)
      }
      return galleryItem
    }
    view.gallery.reduce( isNewBeeId, null ) // Annotate each item with galleryItem.firstOfTrack==true if first item of a track

    view.gallery_by_track = d3.groups(view.gallery, d => d.item.track_key)

    view._emit('gallery-changed', view.gallery)

    this.render()
  }
  render() {
    const view = this

    //const empty_default_gallery = [{item: {}, selected:false, order:0}]


    const bee_id_valid_string = function(item) {
      const R = item.is_bee_id_ref   // Ref vs no ref
      const V = item.bee_id_valid == 'valid'  // valid vs unknown
      return `<span class="beeidflag${V?" valid":""}">${R?"R":"_"}</span></b>`
    }
    const track_valid_string = function(item) {
      const R = item.is_track_ref   // Ref vs no ref
      const V = item.track_valid == 'valid'  // valid vs unknown
      return `<span class="trackflag${V?" valid":""}">${R?"R":"_"}</span></b>`
    }


    view.group_by_track = false
    if (view.group_by_track) {
      // Add a container for the images in this 'track_key'
      let track_containers = view.track_items.selectAll('.track-container')
      .data(view.gallery_by_track, g=>g[0])

      track_containers.enter()
        .append('div')
        .attr('class', 'track-container')
        .each(function(d) {
          const track_div = d3.select(this);
          track_div.append('div').text(d => d[1][0].item.track_id) // Not correct, but just test
          track_div.append('div').attr('class','track-image-container')//.text('CROPS')
        })
      // No update
      track_containers.exit().remove()      

      let item_containers = track_containers.select('.track-image-container')
                                .selectAll('.item-container')
                                .data(g => {console.log(g); return g[1]}, d => d.item.key)
      item_containers.enter()
        .append('div')
        .attr('class', 'item-container')
        .style('text-align', 'center') // Center-align the content
        .style('margin', '5px') // Add some spacing between items
        .attr('id', d => `key-${d.item.key}`)
        .text('IMG')
        .merge(item_containers)
        .each(function(d) {
            const container = d3.select(this);
            const item = d.item

            const container2 = container.append('div').attr('id','crop-div')

            // Add the image
            container2.html('')
                .append('img')
                .attr('class', d => `crop-img`)
                .attr('frame_id', d.item.frame_id)
                .attr('src', view.imagedir+d.item.new_filepath)
                .attr('style', 'width:128px; height:128px; display:block; margin:auto;')
                .on('click', (evt) => view.on_click_item(evt))

            // Add the frame ID below the image
            container2.append('div')
                .attr('class', 'frame-id')
                .html(
                  `#<b>${d.item.key}</b>`
                  +`<br>color_id <b>${item.color_id}</b>`
                  +`<br>bee_id <b>${item.bee_id}</b>`
                  +` <b>${bee_id_valid_string(item)}</b>`
                  +`<br>track_key <b>${item.track_key}</b>`
                  +` <b>${track_valid_string(item)}</b>`
                  +`<br>frame <b>${item.frame_id}</b>`
                  //+`<br>batch <b>${d.item.batch}</b>, bg <b>${d.item.background}</b>`
                  //+`<br>range <b>${d.item.bee_range}</b>, pass <b>${d.item.pass}</b>`
                  //+`<br>TC <b>${d.item.visit.nb_samples}</b>`
                  +`<br>sim <b>${(d.similarity || NaN).toFixed(5)}</b>`
                  )    // HACK: d.visit.nb_samples relies on main to insert the visit info into each detection
                .style('margin-top', '5px') // Add spacing above the text
                .style('font-size', '12px') // Adjust font size
                .style('color', '#555'); // Optional: Change text color
      item_containers.exit().remove()
      });
    } else {
      let gallery = []
      if (this.gallery.length) {
        gallery = this.gallery
      } else {
        gallery = [{item: {}, selected:false, order:0}] // Default empty gallery
      }

      view.track_items.selectAll('.item-separator').remove()

      // Add a container for the images in this 'track_key'
      view.track_items.selectAll('.item-container')
      //.data(view.gallery, d=>d.item.new_filepath)
      .data(gallery, d=>d.item.key)
      .join('div')
        .attr('class', 'item-container')
        .style('text-align', 'center') // Center-align the content
        .style('margin', '5px') // Add some spacing between items
        .attr('id', d => `key-${d.item.key}`)
        .classed('firstOfTrack', d => d.firstOfTrack)
        .each(function(d) {
            const container = d3.select(this);
            const item = d.item
    
            // Add the image
            container.html('')

            if (d.firstOfBeeId) {
              //console.log('Add firstOfTrack separator for',container, d)
              //d3.select(container.node().parentNode)
              //  .insert("div", function() { return container.node(); }) 
              container.append('div')
                .attr('class', 'item-separator bee_id')
            }
            if (!d.firstOfBeeId && d.firstOfTrack) {
              //console.log('Add firstOfTrack separator for',container, d)
              // d3.select(container.node().parentNode)
              //   .insert("div", function() { return container.node(); }) 
              container.append('div')
                .attr('class', 'item-separator track_key')
            }

            const container2 = container.append('div').attr('id','crop-div')
            container2
                .append('img')
                .attr('class', d => `crop-img`)
                .attr('frame_id', d.item.frame_id)
                .attr('src', view.imagedir+d.item.new_filepath)
                .attr('style', 'width:128px; height:128px; display:block; margin:auto;')
                .on('click', (evt) => view.on_click_item(evt))
    
            // Add the frame ID below the image
            container2.append('div')
                .attr('class', 'frame-id')
                .html(
                  `#<b>${d.item.key}</b>`
                  +`<br>color_id <b>${item.color_id}</b>`
                  +`<br>bee_id <b>${item.bee_id}</b>`
                  +` <b>${bee_id_valid_string(item)}</b>`
                  +`<br>track_key <b>${item.track_key}</b>`
                  +` <b>${track_valid_string(item)}</b>`
                  +`<br>frame <b>${item.frame_id}</b>`
                  //+`<br>batch <b>${d.item.batch}</b>, bg <b>${d.item.background}</b>`
                  //+`<br>range <b>${d.item.bee_range}</b>, pass <b>${d.item.pass}</b>`
                  //+`<br>TC <b>${d.item.visit.nb_samples}</b>`
                  +`<br>sim <b>${(d.similarity || NaN).toFixed(5)}</b>`
                  )    // HACK: d.visit.nb_samples relies on main to insert the visit info into each detection
                .style('margin-top', '5px') // Add spacing above the text
                .style('font-size', '12px') // Adjust font size
                .style('color', '#555'); // Optional: Change text color
      });
    }
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

    const nb_selected = view.gallery.reduce((acc,gi)=>acc+gi.selected, 0)
    if (nb_selected>0)
      view.status_div.html(`<b style="color:red;">Selection: ${nb_selected} item${nb_selected?'s':''}</b>`)
    else
      view.status_div.html(`<b style="color:black;">Selection: ${nb_selected} item${nb_selected?'s':''}</b>`)
    view.nb_selected = nb_selected
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
  select_gallery_item(gallery_item, fallback) {
    const view = this

    console.log('select_gallery_item',gallery_item)
    if (!this.gallery.includes(gallery_item)) {
      console.log('gallery_item not found')
      if (fallback) {
        console.log('Trying fallbacks')
        const gi = gallery_item
        gallery_item = null
        if (!gallery_item) {
          console.log('Trying fallback next')
          gallery_item = this.gallery.find(d => (d.order >= gi.order)) // Fallback to next item
        }
        if (!gallery_item) {
          console.log('Trying fallback previous')
          gallery_item = this.gallery.findLast(d => (d.order <= gi.order)) // Fallback to next item
        }
        if (!gallery_item) {
          console.log('Trying fallback gallery[0]')
          gallery_item = this.gallery[0]
        }
      } else {
        console.log("select_gallery_item: item not found. No fallback")
        gallery_item = null
      }
    }

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
  select_item(item, fallback=true) {
    const view = this

    console.log("select_item", item)

    let gallery_item = view.gallery.find(d => d.item == item);
    // FALLBACKS IF key not found
    if (fallback) {
      if (!gallery_item) {
        console.log('Trying fallback track ref')
        gallery_item = this.gallery.find(d => (d.item.track_key == item.track_key) && (d.item.is_track_ref)) // Fallback to track ref
      }
      if (!gallery_item) {
        console.log('Trying fallback first track item')
        gallery_item = this.gallery.find(d => (d.item.track_key == item.track_key)) // Fallback to first track item
      }
      if (!gallery_item) {
        console.log('Trying fallback first same bee_id')
        gallery_item = this.gallery.find(d => (d.item.bee_id == item.bee_id) && (item.bee_id != null)) // Fallback to first track item
      }
    }

    view.select_gallery_item(gallery_item, fallback)
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
    if (evt.shiftKey && evt.ctrlKey) {
      // Do not interfere with Shift+Ctrl shortcuts
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
    if (evt.code=='KeyX') {
      console.log('Expand/Collapse track view')
      view.expand('toggle')
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='ArrowRight') {
      //console.log(evt)
      if (evt.shiftKey) {
        const current = view.scrubbed
        const item = current.item
        let elts = gui.tracks.filter(det => (det.track_key == item.track_key) && (det.frame_id > item.frame_id))
        if (elts.length==0) {console.log('Already at end, ABORT'); return}
        let new_item = elts[0]
        gui.tracks.filter(det => det.track_key == item.track_key).forEach(det=>det.is_track_ref=(det.key==new_item.key))
        if (item.is_bee_id_ref) {
          item.is_bee_id_ref = false
          new_item.is_bee_id_ref = true
        }
        //new_item.is_track_ref = true
        view.update()
        view.select_item(new_item, true)
      } else {
        let elts = view.gallery.filter(det => det.order > view.scrubbed.order)
        if (elts.length==0) {console.log('Already at end, ABORT'); return}
        let new_item = elts[0]
        view.select_gallery_item(new_item, true)
      }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='ArrowLeft') {
      //console.log(evt)
      if (evt.shiftKey) {
        const current = view.scrubbed
        const item = current.item
        let elts = gui.tracks.filter(det => (det.track_key == item.track_key) && (det.frame_id < item.frame_id))
        if (elts.length==0) {console.log('Already at end, ABORT'); return}
        let new_item = elts[elts.length-1]
        gui.tracks.filter(det => det.track_key == item.track_key).forEach(det=>det.is_track_ref=(det.key==new_item.key))
        if (item.is_bee_id_ref) {
          item.is_bee_id_ref = false
          new_item.is_bee_id_ref = true
        }
        //new_item.is_track_ref = true
        view.update()
        view.select_item(new_item, true)
      } else {
        let elts = view.gallery.filter(det => det.order < view.scrubbed.order)
        if (elts.length==0) {console.log('Already at start, ABORT'); return}
        let new_item = elts[elts.length-1]
        view.select_gallery_item(new_item, true)
      }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='ArrowUp') {
      const item = view.scrubbed.item
      const div = view.track_items.select(`div#key-${item.key}`).node()
      const div2 = view.getDivAbove(div)
      console.log(div2)
      if (!!div2) {
        const new_gallery_item = div2.__data__ // a gallery item
        console.log('new_gallery_item',new_gallery_item)
        view.select_gallery_item(new_gallery_item, true)
      }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='ArrowDown') {
      const item = view.scrubbed.item
      const div = view.track_items.select(`div#key-${item.key}`).node()
      const div2 = view.getDivBelow(div)
      console.log(div2)
      if (!!div2) {
        const new_gallery_item = div2.__data__ // a gallery item
        console.log('new_gallery_item',new_gallery_item)
        view.select_gallery_item(new_gallery_item, true)
      }
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
      view.click_label(evt)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyK') {
      // Remove bee_id for track
      view.click_unlabel(evt)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyN') {
      view.click_new_bee()
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyR') {
      view.click_load_refs(evt)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyT') {
      view.click_load_selected_track()
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyB') {
      view.click_load_selected_bee_id(evt)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyE') {
      const item = view.scrubbed?.item
      if (evt.shiftKey) {
        //console.log('Expand whole bee_id for current selection')
        console.log('Expand whole bee_id for currently visible')
        //console.log(evt)
        // if (item.bee_id) {
        //   console.log(`Expanding full bee_id = ${item.bee_id} from item`,item)
        //   view.load_track( gui.get_track_by_bee_id(item.bee_id), true )
        // }
        view.dataset_query.filter_ref={label:'track_key',value:true}
        view.load_track( gui.tracks ) // Load all, then filter
        view.update()
      } else {
        console.log('Expand whole track for current selection')
        //console.log(evt)
        console.log(`Expanding full track track_key = ${item.track_key} from item`,item)
        //view.load_track( gui.get_track_by_key(item.track_key), true )
        view.dataset_query.filter_ref={label:null}
        //view.load_track( gui.tracks ) // Now rely on filters
        view.update()
      }
      view.select_item( item )
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyC') {
      const item = view.scrubbed?.item
      if (evt.shiftKey) {
        //console.log('Collapse whole bee_id for current visible')
        //console.log(evt)
        console.log('Collapse to bee_id ref')
        //if (item.bee_id) {
          //console.log(`Collapsing full bee_id = ${item.bee_id} from item`,item)
          //let items = view.gallery0.map( gi => gi.item ) 
          //view.load_track( items.filter( d => (d.is_bee_id_ref) || (d.bee_id == null) ) )
          view.dataset_query.filter_ref={label:'bee_id',value:true}
          //view.load_track( gui.tracks ) // Now rely on filters
          view.update()
        //}
      } else {
        //console.log('Collapse whole track for current selection')
        //console.log(evt)
        console.log(`Collapse to track ref`)
        //let items = view.gallery0.map( gi => gi.item )
        //view.load_track( items.filter( d => (d.is_track_ref) || ((d.track_key==null)) ) )
        view.dataset_query.filter_ref={label:'track_key',value:true}
        //view.load_track( gui.tracks ) // Now rely on filters
        view.update()
      }
      view.select_item( item )
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyV') {
      const item = view.scrubbed?.item
      if (evt.shiftKey) {
        console.log('Validate purity of bee_id for visible track_keys for item',item)
        if ( gui.tracks.filter( item => item.is_bee_id_ref ).length == 0 ) {
          console.log('bee_id ref not visible, setting to current item')
          item.is_bee_id_ref = true
        } 
        if ( view.gallery.filter( gi => gi.item.is_bee_id_ref ).length == 0 ) {
          console.log('ABORTED: bee_id ref not visible')
        } else {
          console.log('Setting valid for visible items of bee_id')
          view.gallery.filter( gi => gi.item.bee_id == item.bee_id) // for all visible items with same id
                      .map( gi => {gi.item.bee_id_valid = 'valid'} )
          view.render()
          view.select_item( item )
        }
      } else {
        console.log('Validate purity of track for visible track_keys for item',item)
        if ( view.gallery.filter( gi => gi.item.is_track_ref ).length == 0 ) {
          console.log('ABORTED: track ref not visible')
        } else {
          console.log('Setting valid for visible items of track')
          view.gallery.filter( gi => gi.item.track_key == item.track_key) // for all visible items with same id
                      .map( gi => {gi.item.track_valid = 'valid'} )
          view.render()
          view.select_item( item )
        }
      }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyU') {
      const item = view.scrubbed.item
      if (evt.shiftKey) {
        console.log('Unvalidate purity of bee_id for track_keys for item',item)
        gui.tracks.filter( d => d.bee_id == item.bee_id) // for all visible items with same id
                    .map( d => {d.bee_id_valid = 'unknown'} )
        view.render()
        view.select_item( item )
      } else {
        console.log('Unvalidate purity of track for track_keys for item',item)
        gui.tracks.filter( d => d.track_key == item.track_key) // for all visible items with same id
                    .map( d => {d.track_valid = 'unknown'} )
        view.render()
        view.select_item( item )
      }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyI') {
      const current = view.scrubbed
      const item = view.scrubbed.item

      let selected_track_keys;
      if (view.nb_selected>0) {
        const selected_items = view.gallery.filter( gi => gi.selected ).map( gi => gi.item )
        selected_track_keys = [...new Set(selected_items.map( d => d.track_key ))]
        let confirm;
        if (evt.shiftKey) {
           confirm = prompt(`Please confirm: ignoring ${selected_track_keys.length} tracks [${selected_track_keys}]`, 'y')
        } else {
           confirm = prompt(`Please confirm: un-ignoring ${selected_track_keys.length} tracks [${selected_track_keys}]`, 'y')
        }
        if (confirm == 'y') {
          //console.log('SELECTED:', view.gallery.filter( gi => gi.selected ).map( gi => gi.item.track_key ))
        } else {
          selected_track_keys = []
        }      
      } else {
        selected_track_keys = [item.track_key]
      }

      if (selected_track_keys.length>0) {
        let new_ignore_value; // undefined
        if (evt.shiftKey) {
          console.log('Unignore track for track_keys',selected_track_keys)
          new_ignore_value = false
        } else {
          console.log('Ignore track for track_keys',selected_track_keys)
          new_ignore_value = true
        }
        
        const selected_track_keys_set = new Set(selected_track_keys)
        gui.tracks.filter( d => selected_track_keys_set.has(d.track_key)) // for all items with same track
                      .map( d => {d.ignore = new_ignore_value} )

        view.gallery.forEach( gi => gi.selected=false )
        
        gui.refresh()
        view.select_gallery_item( current, true )
      }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='KeyM') { // MERGE bee_ids
      const current = view.scrubbed
      //if (evt.shiftKey) {
      const new_bee_id = current.item.bee_id
        const selected_bee_ids = [...new Set(view.gallery.filter(gi=>gi.selected && gi.item.bee_id!=null).map( gi => gi.item.bee_id ))]
        console.log(`Confirmed. Merging selected bee_ids ${selected_bee_ids} into bee_id ${current.item.bee_id}`)
        const confirm = prompt(`Please confirm: merging selected bee_ids ${selected_bee_ids} into current bee_id ${current.item.bee_id}`, 'y')
        if (confirm == 'y') {
          console.log(`Confirmed. Merging selected bee_ids ${selected_bee_ids} into bee_id ${current.item.bee_id}`)
          for (let bee_id of selected_bee_ids) {
            //if (bee_id == null) continue;
            console.log(`Merging ${bee_id}`)
            const gi = view.gallery.find( gi => gi.item.bee_id == bee_id )
            gui.set_bee_id(gi.item, new_bee_id, `merge-into,key=${new_bee_id}`)
          }
          gui.crop_gallery.reorder()
          gui.crop_gallery2.reorder()
          gui.refresh()
          view.select_gallery_item( current, true )
        // } else {
        //   const selected_track_keys = [...new Set(view.gallery.filter( gi => gi.item.track_key ))]
        //   console.log(`Merging bee_id of selected tracks ${selected_track_keys} into track ${current.item.track_key}`)
        //   for (key of selected_track_keys) {
        //     const gi = view.gallery.find( gi => gi.item.track_key == key )
        //     gui.set_bee_id(gi.item, `merge-into,key=${current.item.key}`)
        //   }
        //   gui.refresh()
        //   view.select_gallery_item( current, true )
        // }
        }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.code=='Backslash') {
      if ((view.dataset_query.scope.label != 'track_id')&&(view.dataset_query.filter_ref.label != null)) {
        console.log(`track splitting only allowed for single track view`)
      } else {
        const track_key = view.dataset_query.scope.value
        const new_track_key = gui.get_track_key_new()
        view.gallery.filter( (gi) => gi.selected )
            .forEach( (gi) => {
                if (gi.item.track_key_orig == null)
                  gi.item.track_key_orig = track_key
                gi.item.track_key = new_track_key
             } )
        view.dataset_query.scope.value = new_track_key
        view.update()
      }
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.key=='[') {
      console.log(`Select before`)
      view.select('before', true)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.key==']') {
      console.log(`Select after`)
      view.select('after', true)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.key=='{') {
      console.log(`Unselect before`)
      view.select('before', false)
      evt.preventDefault();
      evt.stopPropagation()
    }
    if (evt.key=='}') {
      console.log(`Unselect after`)
      view.select('after', false)
      evt.preventDefault();
      evt.stopPropagation()
    }
  };

  // Util function to set predefined filters
  load_track_refs() {
    const view = this
    console.log('Load reference image for each track_key')
    const item = view.scrubbed?.item
    view.dataset_query.scope={}
    view.dataset_query.filter_ref={label:'track_key'}
    view.update()
    view.select_item( item )
  }
  load_bee_id_refs() {
    const view = this
    console.log('Load reference image for each bee_id')
    const item = view.scrubbed?.item
    view.dataset_query.scope={}
    view.dataset_query.filter_ref={label:'bee_id'}
    view.update()
    view.select_item( item )
  }
  load_track_by_key(track_key) {
    const view = this
    console.log(`Loading track track_key = ${track_key}`)
    const item = view.scrubbed?.item
    view.dataset_query.scope={label:'track_key',value:track_key}
    view.dataset_query.filter_ref={label:null} // Default show all frames
    view.update()
    view.select_item( item )
  }
  load_track_by_bee_id(bee_id, expand) {
    const view = this
    console.log(`Loading bee_id = ${bee_id}`)
    const item = view.scrubbed?.item
    view.dataset_query.scope={label:'bee_id',value:bee_id}
    if (expand)
      view.dataset_query.filter_ref={label:null} // If expanded, show all frames
    else
      view.dataset_query.filter_ref={label:'track_key'} // Default show only track_refs
    view.update()
    view.select_item( item )
  }

  //KeyL
  click_label() {
    const selected_track_keys = [...new Set(gui.crop_gallery.gallery.filter(gi=>gi.selected && gi.item.track_key!=null).map( gi => gi.item.track_key ))]
    const current = gui.crop_gallery.scrubbed   // FIXME: not same for  gallery and gallery2
    if (selected_track_keys.length>0) { // Red selection
      const confirm = prompt(`Please confirm: label ${selected_track_keys.length} tracks [${selected_track_keys}] with bee_id ${gui.crop_gallery2.scrubbed.item.bee_id}`, 'y')
      if (confirm == 'y') {
        gui.details.set_bee_ids_from2() // Label all the red selections
      }
    } else { // Regular selection
      gui.details.set_bee_id_from2() // Label the current blue selection
    }
    let next = gui.crop_gallery.gallery.find(d => d.order >= current.order)
    if (next == null) next = gui.crop_gallery.gallery[0] 
    gui.crop_gallery.reorder()
    gui.crop_gallery.update()
    gui.crop_gallery.select_gallery_item(next)
    gui.crop_gallery2.reorder()
    gui.crop_gallery.update()
  }
  //KeyK
  click_unlabel() {
    const current = this.scrubbed
    const selected_items = this.gallery.filter(gi=>gi.selected && gi.item.track_key!=null).map( gi => gi.item )
    const selected_track_keys = [...new Set(selected_items.map( d => d.track_key ))]

    if (selected_track_keys.length>0) { // Red selection
      const confirm = prompt(`Please confirm: unlabel bee_id from ${selected_track_keys.length} tracks [${selected_track_keys}]`, 'y')
      if (confirm == 'y') {
        gui.set_tracks_bee_id(selected_items, null) // Unlabel all the red selections
      }
    } else { // Regular selection
      gui.set_bee_id(current.item, null) // Unlabel current item
    }

    gui.refresh()

    let next = this.gallery.find(d => d.order >= current.order)
    if (next == null) next = this.gallery[0] 

    this.select_gallery_item(next)
  }
  // KeyN
  click_new_bee(evt) {
    const view = this
    console.log('New bee_id in gallery1')
    //console.log(evt)
    const current = gui.crop_gallery.scrubbed

    const selected_items = view.gallery.filter( gi => gi.selected ).map( gi => gi.item )
    const selected_track_keys = [...new Set(selected_items.map( d => d.track_key ))]
    if (selected_track_keys.length>0) {
      let confirm;
      confirm = prompt(`New bee_id: ABORTED, not compatible with red selection. Create new bee_id from only blue selection.`, 'CANCEL')
      return
    }

    gui.details.set_bee_id_new()
    //gui.details.set_detail2( gui.details.item )
    gui.crop_gallery2.reorder()
    gui.crop_gallery2.select_item( gui.details.item )

    let next = gui.crop_gallery.gallery.find(d => d.order >= current.order)
    if (next == null) next = gui.crop_gallery.gallery[0]
    gui.crop_gallery.select_gallery_item(next)
  }
  click_load_refs(evt) {
    const view = this
    if (evt.shiftKey) {
      view.load_bee_id_refs()
    } else {
      view.load_track_refs()
    }
  }
  click_load_selected_track() {
    const view = this
    console.log('Load whole track for current selection')
    //console.log(evt)
    const item = view.scrubbed?.item
    if (!item) { console.log('No item selected, IGNORED'); return }
    view.load_track_by_key(item.track_key)
  }
  click_load_selected_bee_id(evt) {
    const view = this
    //console.log('Load all items with bee_id for current selection')
    //console.log(evt)
    const item = view.scrubbed?.item
    if (!item) { console.log('No item selected, IGNORED'); return }
    if (evt.shiftKey) {
      view.load_track_by_bee_id(item.bee_id, true) // Expand
    } else {
      view.load_track_by_bee_id(item.bee_id)
    }
  }
  

  getDivAbove(currentDiv) {
    const rect = currentDiv.getBoundingClientRect();
    const currentBottom = rect.bottom;
  
    const siblings = Array.from(currentDiv.parentNode.children);
    let bestMatch = null;
    let minVerticalGap = Infinity;
  
    for (const sibling of siblings) {
      if (sibling === currentDiv) continue;
  
      const sibRect = sibling.getBoundingClientRect();
  
      const isAbove = sibRect.top < rect.top; // visually higher
      const horizontallyOverlaps =
        sibRect.left < rect.right && sibRect.right > rect.left;
  
      if (isAbove && horizontallyOverlaps) {
        const verticalGap = rect.top - sibRect.bottom;
  
        if (verticalGap >= 0 && verticalGap < minVerticalGap) {
          minVerticalGap = verticalGap;
          bestMatch = sibling;
        }
      }
    }
  
    return bestMatch;
  }
  getDivBelow(currentDiv) {
    const rect = currentDiv.getBoundingClientRect();
    const currentBottom = rect.bottom;
  
    const siblings = Array.from(currentDiv.parentNode.children);
    let bestMatch = null;
    let minVerticalGap = Infinity;
  
    for (const sibling of siblings) {
      if (sibling === currentDiv) continue;
  
      const sibRect = sibling.getBoundingClientRect();
  
      const isBelow = sibRect.top > rect.top; // visually lower
      const horizontallyOverlaps =
        sibRect.left < rect.right && sibRect.right > rect.left;
  
      if (isBelow && horizontallyOverlaps) {
        const verticalGap = sibRect.top - rect.bottom;
  
        if (verticalGap >= 0 && verticalGap < minVerticalGap) {
          minVerticalGap = verticalGap;
          bestMatch = sibling;
        }
      }
    }
  
    return bestMatch;
  }
  
  select(where, value=true) {
    const view = this

    if (where == 'all') {
      view.gallery.forEach( (gi) => {gi.selected = value} )
    } else if (where == 'before') {
      let order0 = view.scrubbed.order
      let elts = view.gallery.filter(det => det.order <= order0)
      elts.forEach( (gallery_item) => gallery_item.selected = value )
    } else if (where == 'after') {
      let order0 = view.scrubbed.order
      let elts = view.gallery.filter(det => det.order >= order0)
      elts.forEach( (gallery_item) => gallery_item.selected = value )
    } else if (where == 'invert') {
      view.gallery.forEach( (gi) => {gi.selected = !gi.selected} )
    } else {
      console.log('unrecognized select',where)
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
  node() {
    return this.div.node()
  }
  init() {
    const scrubber = this
    scrubber.active = false
    scrubber.visible = true
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
    scrubber.div.classed('hidden',!scrubber.visible)
    if (!scrubber.visible) {return}
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
  toggle_visibility(toggle='toggle') {
    const scrubber = this
    if (toggle == 'toggle')
      this.visible = !this.visible
    else
      this.visible = !!toggle
    if (!this.visible)
      this.active=false
    scrubber.render()
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

    makeDispatchable(band, ["gallery-item-scrubbed"])

    band.init()
  };
  node() {
    return this.canvas.node()
  }
  init() {
    const band = this
    band.visible = false // Start hidden

    band.selected_idx = -1

    band.canvas = d3.select(band.config.parentElement)
      .append("canvas")
      .attr("id","csvCanvas")
      .style('image-rendering','pixelated')
      .style('display',band.visible?'block':'none')
      .style('width','100%')
      .style('height','128px')
      //.on('click', evt => band.band_mouseclick(evt))
      .on('mousedown', evt => band.band_mousedown(evt))

    band.gallery_track = []
    band.feature_keys = []
    band.normalizedRows = undefined

    band.scrubbing = false
    this.band_endscrub = this.band_endscrub.bind(this); // Bind to this
    this.band_mouseclick = this.band_mouseclick.bind(this)
  };
  load_features(csv_file='/data/reid/batch_1_train_embeddings_26w82ua9.csv') {
      const band = this
      console.log(`load_features, Loading features from ${csv_file}`)
      d3.csv(csv_file)
        .catch( (err) => console.error("load_features, Error loading CSV:", err) )
        .then(function (data) {
          console.log(`features loaded, ${data.length} rows`)
          //band.data = data
          //gtracks.features = data
          
          const featureNames = Array.from({ length: 128 }, (_, i) => `feature_${i}`);
          const rows = data.map(row => featureNames.map(name => parseFloat(row[name])));

          band.feature_keys = data.map(row => Number(row.key));
          // FIXME: for the moment, assume all keys are range(N)

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
  }
  set_gallery_track(gallery_track) {
    this.gallery_track = gallery_track
    this.update()
  };
  band_mousedown(evt) {
    const band = this
    //console.log(`band_mouseclick`,evt)
  
    band.scrubbing = true
    band.scrub_idx = -1
    band.canvas.on('mouseup', band.band_endscrub) // Make sure it is bound to this
    band.canvas.on('mouseleave', band.band_endscrub)
    band.canvas.on('mousemove', band.band_mouseclick)

    band.band_mouseclick(evt)
  }
  band_endscrub(evt) { // Bound to this in constructor
    const band = this
    band.scrubbing = false
    band.canvas.on('mouseup', null)
    band.canvas.on('mouseleave', null)
    band.canvas.on('mousemove', null)
  }
  band_mouseclick(evt) {
    const band = this
    //console.log(`band_mouseclick`,evt)
  
    const rect = evt.srcElement.getBoundingClientRect();
    const x = evt.clientX - rect.left;
  
    const idx = Math.floor(x / rect.width * band.gallery_track.length)

    if (idx != band.scrub_idx) {
      band.scrub_idx = idx;
      const d = band.gallery_track[idx]
      band._emit("gallery-item-scrubbed", d)
    }
  }
  select_item(item) {
    if (item == null) {
      this.selected_idx == -1
    } else {
      this.selected_idx = this.gallery_track.findIndex(d => d.item.key == item.key) // FIXME
    }
    this.render(false)
  };
  update() {
    const band = this

    if (band.visible && band.normalizedRows!=null) {
      //const indices = data.map(row => +row['key']);
    
      // FIXME: for the moment, assume all keys are range(N)
      // Else, would need a map band.normalizedRows[key_to_feature_idx.get(gallery_item.item.key)]
      const rows2 = band.gallery_track.map(gallery_item => band.normalizedRows[gallery_item.item.key])
      //console.log(rows2)

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

    if (!display_data) {
      console.log('WARNING: FeatureBand.render: display_data not defined. ABORT')
      return
    }

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

    // SHOW SELECTED ID(s)
    //selected_idx = band.selected_idx
    {
      const selected_idx = band.selected_idx
      const pixels = imageData.data;
      let r=0,g=0,b=0
      for (let x=0; x<display_data.length; x++) {
        let is_current = (x == selected_idx)
        if (is_current) {r=0; g=0; b=255}
        else {r=255, g=255, b=255}
        for (let y=0; y<10; y++) {
          const index = ((y+128+10) * width + x) * 4; // Each pixel has 4 values (RGBA)
          pixels[index] = r; // Red
          pixels[index + 1] = g; // Green
          pixels[index + 2] = b; // Blue
          pixels[index + 3] = 255; // Alpha (fully opaque)
        }
        let is_selected = band.gallery_track[x].selected
        if (is_selected) {r=255; g=0; b=0}
        else {/* Keep same color as current */}
        for (let y=0; y<5; y++) {
          const index = ((y+128+10) * width + x) * 4; // Each pixel has 4 values (RGBA)
          pixels[index] = r; // Red
          pixels[index + 1] = g; // Green
          pixels[index + 2] = b; // Blue
          pixels[index + 3] = 255; // Alpha (fully opaque)
        }
      }
    }
  
    // Put the ImageData onto the canvas
    context.putImageData(imageData, 0, 0);
  };
  render_selection() {
    this.render(false)
  }
  toggle_visibility(toggle='toggle') {
    if (toggle == 'toggle')
      this.visible = !this.visible
    else
      this.visible = !!toggle
    this.update()
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

function bool(value) {
  if (typeof value === 'boolean') return value;
  if (value == null) return null;
  if (typeof value === 'string') {
    switch (value.trim().toLowerCase()) {
      case 'true':
      case '1':
      case 'yes':
      case 'y':
      case 'on':
        return true;
      case 'false':
      case '0':
      case 'no':
      case 'n':
      case 'off':
        return false;
    }
  }
  return Boolean(value);  // fallback: JS truthiness
}

class CropDetails {
  constructor(_config) {
    const details = this
    details.config = {
      parentElement: _config.parentElement,
      //gallery: _config.gallery,    // Connect gallery for two-way communication
      //gallery2: _config.gallery2,
      //side: _config.side || 'left'
    }
    details.gallery = _config.gallery
    details.gallery2 = _config.gallery2
    details.item = undefined;
    details.item2 = undefined;

    details.crop_props = ['key','frame_id','new_filepath','crop_labels']
    details.track_props = ['track_key','track_id','ignore','bee_id','paint','paintcode','color_id','tag','tagid','track_labels']
    details.props_schema = {
      default:{type:'str', editable:true},
      key:{editable:false},
      frame_id:{type:'int',editable:false},
      new_filepath:{editable:false},
      crop_labels:{editable:true},
      track_key:{type:'int',editable:false},
      track_id:{type:'int',editable:true, validation:'avoid_track_id_conflict'},
      ignore:{type:'bool', editable:true},
      bee_id:{type:'int', editable:true},
      paint:{editable:true},
      paintcode:{editable:true},
      color_id:{type:'int',editable:true},
      tag:{editable:true},
      tagid:{editable:true},
      track_labels:{editable:true},
    }

    makeDispatchable(details, ["bee_id_changed","bee_ids_changed"])

    details.init()
  }
  node() {
    return this.div.node()
  }
  left_node() {
    return this.left_div.node()
  }
  right_node() {
    return this.right_div.node()
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
    details.left_div = detail_div

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
    details.right_div = detail_div2

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

    // Table templates
    let crop_attr_html = ''
    for (let attr of details.crop_props) {
      const schema = Object.assign({}, details.props_schema['default'], details.props_schema[attr]);
      const attr_level = 'attr-crop'
      if (schema.editable) {
        crop_attr_html += `<tr><td>${attr}</td><td><input class='attr attr-input ${attr_level}' id='${attr}'></input></td></tr>`
      } else {
        crop_attr_html += `<tr><td>${attr}</td><td><span class='attr ${attr_level}' id='${attr}'></span></td></tr>`
      }
    }
    let track_attr_html = ''
    // Track which fields are currently selected for showing
    let shown_fields = details.track_props.filter(f => !(details.track_props_hidden||[]).includes(f));
    let all_hidden = details._track_props_all_hidden || false;
    for (let attr of details.track_props) {
      const schema = Object.assign({}, details.props_schema['default'], details.props_schema[attr]);
      const attr_level = 'attr-track'
      const row_style = (!all_hidden && shown_fields.includes(attr)) ? '' : ' style="display:none;"';
      if (schema.editable) {
        track_attr_html += `<tr class="track-prop-row" data-attr="${attr}"${row_style}><td>${attr}</td><td><input class='attr attr-input ${attr_level}' id='${attr}'></input></td></tr>`
      } else {
        track_attr_html += `<tr class="track-prop-row" data-attr="${attr}"${row_style}><td>${attr}</td><td><span class='attr ${attr_level}' id='${attr}'></span></td></tr>`
      }
    }
    // Add a toggle for hiding/showing all selected track props
    let track_toggle_html = `<button type=\"button\" id=\"toggle_track_props_btn\" style=\"margin-left:8px;\">${all_hidden ? 'Show' : 'Hide'} track props</button>`

    // DETAIL
    if (details.item) {
      let d = details.item
      details.div.select('#detail-div > img')
        .attr("src",details.gallery.imagedir+d.new_filepath)

      const table = details.div.select('#detail-info > .detail-table')
        .html(`<table>
        <tr><td colspan="2"><b>Crop props</b> <button id="choose_crop_props_button">Choose</button></td></tr>
        ${crop_attr_html}
        <tr><td colspan=\"2\"><b>Track props</b> <button id=\"choose_track_props_button\">Choose</button>${track_toggle_html}</td></tr>
        ${track_attr_html}
      </table>`)

      // Toggle all selected track props visibility
      table.selectAll('#toggle_track_props_btn').on('click', function() {
        details._track_props_all_hidden = !details._track_props_all_hidden;
        details.render();
      })

      table.selectAll('#choose_crop_props_button').on('click', (evt) => details.choose_crop_props_button_clicked())
      table.selectAll('#choose_track_props_button').on('click', (evt) => details.choose_track_props_button_clicked())

      table.selectAll(`input.attr-input`)
      .classed('attr-item',true)
      .attr('value', (_, i, nodes) => d[nodes[i].id])  // .id is attr name
      .on('change', (evt)=> details.input_changed_attr(evt))  // Also cover bee_id

      table.selectAll(`span.attr`)
        .text((_, i, nodes) => d[nodes[i].id])  // .id is attr name
    } else {
      //Empty details
      details.div.select('#detail-div > img')
        .attr("src",'')
      details.div.select('#detail-info > .detail-table')
        .html('No selection')
    }
    // DETAIL2
    if (details.item2) {
      let d = details.item2 || {}
      details.div.select('#detail-div2 > img')
        .attr("src",details.gallery2.imagedir+d.new_filepath)

      const table = details.div.select('#detail-info2 > .detail-table')
        .html(`<table>
        <tr><td colspan="2"><b>Crop props</b> <button id="choose_crop_props_button">Choose</button></td></tr>
        ${crop_attr_html}
        <tr><td colspan=\"2\"><b>Track props</b> <button id=\"choose_track_props_button\">Choose</button>${track_toggle_html}</td></tr>
        ${track_attr_html}
      </table>`)

      table.selectAll('#toggle_track_props_btn').on('click', function() {
        details._track_props_all_hidden = !details._track_props_all_hidden;
        details.render();
      })

      table.selectAll('#choose_crop_props_button').on('click', (evt) => details.choose_crop_props_button_clicked())
      table.selectAll('#choose_track_props_button').on('click', (evt) => details.choose_track_props_button_clicked())

      table.selectAll(`input.attr-input`)
      .classed('attr-item2',true)
      .attr('value', (_, i, nodes) => d[nodes[i].id])
      .on('change', (evt)=> details.input_changed_attr(evt))

      table.selectAll(`span.attr`)
        .text((_, i, nodes) => d[nodes[i].id])
    } else {
      //Empty details
      details.div.select('#detail-div2 > img')
        .attr("src",'')
      details.div.select('#detail-info2 > .detail-table')
        .html('No selection')
    }
    
  };
  
  
  choose_crop_props_button_clicked() {
    const comma_list = this.crop_props.join(',')
    const val = prompt('crop_props list:', comma_list)
    if (val != null)
      this.crop_props = val.split(",")
    this.render()
  }
  choose_track_props_button_clicked() {
    const comma_list = this.track_props.join(',')
    const val = prompt('track_props list:', comma_list)
    if (val != null)
      this.track_props = val.split(",")
    this.render()
  }
  input_changed_attr(evt) {
    console.log('input_changed_attr',evt)
    const input = evt.srcElement
    const input_d3 = d3.select(input)
    
    const attr = input_d3.attr('id')
    const value = input.value
    //this.set_attr(attr, input.value)
    const track_level = input_d3.classed('attr-track')
    
    let item
    if (d3.select(input).classed('attr-item')) {
      item = this.item
    } else if (d3.select(input).classed('attr-item2')) {
      item = this.item2
    } else {
      console.log(`input_changed_attr: internal error, input. ABORTED`, input)
      return
    }
    if (track_level) {
      console.log(`input_changed_attr: track-level`)
      if (attr=='bee_id') {
        gui.set_bee_attr(item, attr, value) // TODO: uniformize attr editing
      } else {
        gui.set_bee_attr(item, attr, value)
      }
    } else {
      console.log(`input_changed_attr: crop-level`)
      // Change just this crop
      gui.set_bee_attr(item, attr, value, false) // Do not propagate
    }
  }
  set_attr(attr, value, source="manual") { // Set bee_id for detail1
    console.log('set_attr',attr,value)
    let item = this.item

    gui.set_bee_attr(this.item, attr, value)

    //this.div.select(`.attr#${attr}`)
    //    .attr('value', value) // Should not trigger change event

    //this._emit("bee_attr_changed", item) // May trigger change id to the whole track at gui level
  }

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

class GUILayout {
  constructor(gui, _config) {
    const layout = this
    this.gui = gui
    gui.config = {
      main: _config.main,
    }
    
    layout.main = _config.main
    layout.buttons_div = layout.main.append("div")
      .attr('id','buttons-div')
    layout.gallery_toolbar = layout.main.append('div')
      .attr('class','toolbar')
      .attr('id','gallery_toolbar')

    layout.nodes = {}
    layout.nodes.main = layout.main.node()
    layout.nodes.buttons_div = layout.buttons_div.node()
    layout.nodes.gallery_toolbar = layout.gallery_toolbar.node()
  }
  unparent_all() {
    const layout = this
    layout.nodes.crop_gallery = this.gui.crop_gallery?.node?.()
    layout.nodes.crop_gallery2 = this.gui.crop_gallery2?.node?.()
    layout.nodes.details = this.gui.details?.node?.()
    layout.nodes.feature_band = this.gui.feature_band?.node?.()
    layout.nodes.scrubber_node = this.gui.scrubber?.node?.()
    layout.nodes.buttons_div.remove?.()
    layout.nodes.gallery_toolbar.remove?.()
    layout.nodes.crop_gallery?.remove?.()
    layout.nodes.crop_gallery2?.remove?.()
    layout.nodes.details?.remove?.()
    layout.nodes.feature_band?.remove?.()
    layout.nodes.scrubber_node?.remove?.()
  }
  reparent(parent, child) {
    if (!child) return
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    parent.appendChild(child);  
  }
  default_layout() {
    const layout = this
    layout.unparent_all()
    layout.main.html('')
    // Reparent
    const main = layout.nodes.main
    layout.nodes.main.appendChild(layout.nodes.buttons_div)
    layout.nodes.main.appendChild(layout.nodes.gallery_toolbar)
    if (layout.gui.details) {
      layout.reparent(main, layout.gui.details.div.node())
      // layout.reparent(layout.gui.details.div.node(), layout.gui.details.left_div.node())
      // layout.reparent(layout.gui.details.div.node(), layout.gui.details.right_div.node())
    }
    layout.reparent(main, layout.nodes?.crop_gallery)
    layout.reparent(main, layout.nodes?.scrubber_node)
    layout.reparent(main, layout.nodes?.feature_band)
    layout.reparent(main, layout.nodes?.crop_gallery2)
    layout.gui.crop_gallery.expand(false)
    layout.gui.crop_gallery2.expand(false)
  }
  two_columns_layout() {
    const layout = this
    layout.unparent_all()
    layout.main.html('')
    // Reparent
    const main = layout.nodes.main
    layout.reparent(main, layout.nodes.buttons_div)
    layout.reparent(main, layout.nodes.gallery_toolbar)
    layout.reparent(main, layout.gui.details.div.node())
    const columns = layout.main.append('div').attr('id','columns_container').attr('class','columns-container')
    const left_column = columns.append('div').attr('id','left_column').attr('class','column').style('width','50%').node()
    const right_column = columns.append('div').attr('id','right_column').attr('class','column').style('width','50%').node()
    //left_column.appendChild(layout.gui.details.left_node())
    left_column.appendChild(layout.nodes.crop_gallery)
    left_column.appendChild(layout.nodes.scrubber_node)
    left_column.appendChild(layout.nodes.feature_band)
    //right_column.appendChild(layout.gui.details.right_node())
    right_column.appendChild(layout.nodes.crop_gallery2)
    layout.gui.crop_gallery.expand(true)
    layout.gui.crop_gallery2.expand(true)
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
    if (!gui.tracks) gui.tracks = []

    console.log('TrackSplitGUI tracks=',gui.tracks)

    gui.init()
  }
  init() {
    const gui = this
    const main = gui.main

    gui.tableDialog = new TableDialog('Tracks Loading')
    gui.openDialog = new LoadDataDialog('Load Data')

    main.html('')

    gui.layout = new GUILayout(gui, {main: main})

    const buttons_div = gui.layout.buttons_div
    buttons_div.append("button")
        .text("Open JSON dataset...")
        .on('click', () => gui.openDialog.open())
    // buttons_div.append("button")
    //     .text("Open CSV data...")
    //     .on('click', () => gui.openDialog.open())
    buttons_div.append("button")
      .text("Save")
      .on('click', () => gui.save_to_csv())
    buttons_div.append("div").attr('id','csv_path').style('display','inline')
      .text("csv_path = ?")
    // buttons_div.append("button")
    //     .text("Select track to label")
    //     .on('click', () => gui.tableDialog.open()) // Obsolete
    buttons_div.append("br")
    buttons_div.append("button")
      .text("Hide/Show Scrubber")
      .on('click', function () {gui.scrubber.toggle_visibility()})
    buttons_div.append("button")
      .text("Hide/Show Features")
      .on('click', function () {gui.feature_band.toggle_visibility()})

    buttons_div.append("span")
        .text(" - Layout:")
        .on('click', () => gui.default_layout())

    buttons_div.append("button")
        .text("1 Column")
        .on('click', () => gui.layout.default_layout())
    buttons_div.append("button")
        .text("2 Columns")
        .on('click', () => gui.layout.two_columns_layout())

    const gallery_toolbar = gui.layout.gallery_toolbar
    gallery_toolbar.append("button")
      .text("Load ref crops")
      .on('click', evt => {
          //let track = gui.get_ref_per_track()
          //gui.crop_gallery.load_track(track)
          gui.crop_gallery.load_track_refs()
        } )
    gallery_toolbar.append("button")
      .text("SET MODE: label bee_id")
      .on('click', evt => {
          gui.crop_gallery.dataset_query.filter_label = {label:'bee_id', value:false}
          gui.crop_gallery2.dataset_query.filter_label = {label:'bee_id', value:true}
          gui.crop_gallery.update()
          gui.crop_gallery2.update()
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
    gui.scrubber.toggle_visibility(false) // Start hidden

    gui.feature_band = new FeatureBand({parentElement: main.node()})
    gui.feature_band.on("gallery-item-scrubbed", 
          function (gallery_item) {
            gui.crop_gallery.select_gallery_item(gallery_item, true)
            gui.details.set_detail(gallery_item.item)
          })

    const gallery2_toolbar = main.append('div')
        .attr('class','toolbar')
        .attr('id','gallery2_toolbar')
    gallery2_toolbar.append("button")
      .text("Load ref crops")
      .on('click', evt => {
        //let track = gui.get_one_per_track()
        //gui.crop_gallery2.load_track(track)
        gui.crop_gallery2.load_track_refs()
      } )

    gui.crop_gallery2 = new CropGallery({parentElement: main.node(), showToolbar: false, autoScrollToCenter: true})
    gui.crop_gallery2.on("item-selected", (item) => gui.details.set_detail2(item) )
      .on("item-unselected", () => { gui.details.set_detail2(null) } )

    gui.details = new CropDetails({parentElement: main.node(), gallery: gui.crop_gallery, gallery2: gui.crop_gallery2})
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

    //gui.layout.default_layout()
    gui.layout.two_columns_layout()
  };
  hard_refresh() {
    gui.crop_gallery.load_track( gui.tracks )
    gui.crop_gallery2.load_track( gui.tracks )
    gui.crop_gallery.select_gallery_item( gui.crop_gallery.gallery[0] ) // Problem with async loading??
    gui.crop_gallery2.select_gallery_item( gui.crop_gallery2.gallery[1] )
    this.refresh()
  }
  refresh() {
    this.crop_gallery.update()
    this.crop_gallery2.update()
    this.details.render()
    this.feature_band.render()
  }

  async load_dataset_json(json_path = '/data/flowerpatch/flowerpatch_20240606_11h04.crops_dataset.json') {
    const gui = this

    console.log(`Loading dataset JSON from ${json_path}`)
    const dataset_config = await d3.json(json_path)

    console.log(`dataset_config:`,dataset_config)

    const dirname = json_path.substring(0, json_path.lastIndexOf('/'));

    gui.dataset = {}
    gui.dataset.json_path = json_path //TODO add more config for csv cols
    gui.dataset.dirname = dirname
    gui.dataset.config = dataset_config

    gui.update_dataset() // allow reloading after changing gui.dataset main parameters
  }
  update_dataset() {
    const gui = this
    const dataset = gui.dataset
    const dataset_config = gui.dataset.config
    console.log(`load_dataset_json: using root dirname=${gui.dataset.dirname}`)
    console.log(`load_dataset_json: using csv_path=${dataset_config.tracks_csv}`)
    console.log(`load_dataset_json: using crops_dir=${dataset_config.crops_dir}`)
    console.log(`load_dataset_json: using features_csv=${dataset_config.features_csv}`)

    // FIXME: cleaner separation between original parameters and computed parameters?
    gui.dataset.tracks_csv = joinPaths(gui.dataset.dirname, dataset_config.tracks_csv)
    gui.dataset.crops_dir = joinPaths(gui.dataset.dirname, dataset_config.crops_dir)
    gui.dataset.features_csv = null
    if (dataset_config.features_csv != null)
      gui.dataset.features_csv = joinPaths(gui.dataset.dirname, dataset_config.features_csv)

    // Set imagedir before, so that it is defined at the time of loading the tracks
    gui.crop_gallery.set_imagedir(gui.dataset.crops_dir)
    gui.crop_gallery2.set_imagedir(gui.dataset.crops_dir)

    gui.load_csv(gui.dataset.tracks_csv, gui.dataset.schema) // calls hard_refresh()

    if (gui.dataset.features_csv) {
      gui.feature_band.load_features(gui.dataset.features_csv)
    }
  }

  async load_csv(csv_path = '/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch2_sample_num_max.csv', 
                  schema=null) {
    const gui = this
    //gtracks.visits = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.visits.csv')
    //gtracks.tracks = await d3.csv('data/flowerpatch/flowerpatch_20240606_11h04.tracks.csv')
    //const tracks = await d3.csv('/data/reid/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv')

    let tracks = await d3.csv(csv_path)
    gui.tracks = tracks
    gui.csv_path = csv_path
    gui.main.select('#csv_path').text(`csv_path = ${csv_path}`)

    //let imagedir = '/data/reid/images/'

    if (schema == null) {
      // Auto determination
      if ((tracks[0].crop_filename!=null) && (!tracks[0].new_filepath))
        schema = 'flowerpatch'
      else
        schema = 'reid'
    }
    console.log(`Identified schema=${schema}`)

    // FIXME:  UNIFORMIZE THE DATA SCHEMA
    // Flowerpatch data
    if (schema == 'flowerpatch') {
      console.log("WARNING: recognized flowerpatch data format, converting to reid format")
      tracks.forEach( (d, id) => {
        d.new_filepath = d.crop_filename
        d.frame_id = +d.frame
        d.key = id
        d.track_key = +d.track_id
        d.video_name = 'flowerpatch'
        // Only set bee_id if not present or is empty/0/null
        if (d.bee_id === undefined || d.bee_id === null || d.bee_id === '' || d.bee_id === '0') {
          d.bee_id = undefined
        } else {
          d.bee_id = Number(d.bee_id)
        }
        if (isNaN(d.bee_id)) d.bee_id = null
      })
      //imagedir = '/data/flowerpatch/crops/'
      categories_to_indices(tracks, 'video_name', 'video_key')
    } else if (schema == 'reid') { // ReID data
      // Only set bee_id if not present
      tracks.forEach((d, id) => {
        if (d.bee_id === undefined) {
          d.bee_id = Number(d.ID)
        } else {
          d.bee_id = Number(d.bee_id)
        }
        if (isNaN(d.bee_id)) d.bee_id = null
      })

      convert_columns_to_number(tracks, ['key','track_id','frame_id','pass'])

      // Sanitize pass
      const videoNameRegex = /^(.*?\.mp4)\.(track\d+)/;
      for (let det of tracks) {
        det['pass'] = Math.round(det['pass'])
        // young-adults-white-blue-in-lab-65-96_batch_2.mp4.track000010.frame002815.png
        if (det.new_filepath) {
          let match = det.new_filepath.match(videoNameRegex)
          det['video_name'] = match ? (match[1]) : 'no_video_name'
          if (det['video_name'] == 'no_video_name') {
            console.log(`WARNING: could not extract video_name from filepath=${det.filepath}`)
          }
          det['track_name'] = match ? (match[1]+'.'+match[2]) : `B${det['batch']}_E${det['environment']}_b${det['background']}_P${det['pass']}_r${det['bee_range']}_T${det['track_id']}`
        }
      }
      categories_to_indices(tracks, 'video_name', 'video_key')
      categories_to_indices(tracks, 'track_name', 'track_key') // to avoid track_id which is video specific
      drop_columns(tracks, ['Unnamed: 0.5','Unnamed: 0.4','Unnamed: 0.3','Unnamed: 0.2','Unnamed: 0.1','Unnamed: 0','ID'])
    } else {
      console.log(`Unknown track schema ${schema}. LEFT AS IS, may not work`)
    }

    // --- Ensure all internal fields are present and preserved ---
    // List of fields to preserve (add more as needed)
    const internalFields = [
      'bee_id', 'bee_id_src', 'bee_id_orig', 'ignore',
      'is_track_ref', 'is_bee_id_ref', 'bee_id_valid', 'track_valid'
    ];
    // For each row, ensure all fields are present and coerce types if needed
    tracks.forEach(d => {
      internalFields.forEach(f => {
        if (!(f in d) || d[f] === undefined) {
          // Set default values for missing fields
          if (f === 'ignore' || f === 'is_track_ref' || f === 'is_bee_id_ref') {
            d[f] = false;
          } else if (f === 'bee_id_valid' || f === 'track_valid') {
            d[f] = 'unknown';
          } else {
            d[f] = null;
          }
        } else {
          // Try to coerce to correct type if present
          if (f === 'ignore' || f === 'is_track_ref' || f === 'is_bee_id_ref') {
            d[f] = (d[f] === true || d[f] === 'true' || d[f] === 1 || d[f] === '1');
          }
        }
      });
    });
    // --- End ensure internal fields ---

    // Preselect Reference items for each track
    let track_refs = gui.get_one_per_track()
    gui.tracks.forEach( item => {item.is_track_ref = false; item.is_bee_id_ref = false} )
    track_refs.forEach( item => {item.is_track_ref = true} )
    let bee_id_refs = gui.get_one_per_bee_id()
    bee_id_refs.forEach( item => {item.is_bee_id_ref = true} )

    //tracks = d3.sort( tracks, d => d.new_filepath ) // Do not sort to keep keys aligned
    console.log(`load_csv: tracks loaded, ${tracks.length} rows`)

    gui.hard_refresh()
  }
  jsonToCsv(json) {
    //const keys = Object.keys(json[0]);
    const keys = [...new Set(json.flatMap(Object.keys))];
    const csvRows = [
      keys.join(","),                            // header
      ...json.map(row => keys.map(k => JSON.stringify(row[k] ?? "")).join(",")) // rows
    ];
    return csvRows.join("\n");
  }
  downloadCSV(filename, json) {
    const csv = this.jsonToCsv(json);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
  
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = "none";
  
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  getFormattedTimestamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
  
    const year = String(now.getFullYear()); // YYYY
    const month = pad(now.getMonth() + 1);           // MM
    const day = pad(now.getDate());                  // DD
    const hours = pad(now.getHours());               // hh
    const minutes = pad(now.getMinutes());           // mm
    const seconds = pad(now.getSeconds());           // ss
  
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }
  save_to_csv() {
    const filename = this.csv_path.split("/").pop(); // "myfile.txt"
    const nameWithoutExt = filename.replace(/\.csv$/i, "");
    const timestamp = this.getFormattedTimestamp()
    this.downloadCSV(nameWithoutExt+'.labeled.'+timestamp+'.csv', gui.tracks)
  }

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
    console.log(`get_track_by_key(${track_key})`)
  
    let track = gui.tracks.filter(det => det.track_key == track_key)
    return track
  }
  get_track_by_bee_id(bee_id) {
    const gui = this
    console.log(`get_track_by_bee_id(${bee_id})`)
  
    let track = gui.tracks.filter(det => det.bee_id == bee_id)
    return track
  }
  get_one_per_track(input_tracks=null) {
    const gui = this
    function getMiddleDetections(tracks) {
      // Group by track_id using d3.group
      const grouped = d3.group(tracks, d => d.track_key );
        //'K'+d.color_id+'_'+d.track_id+'_'+d.batch+'_'+d.pass+'_'+d.environment+'_'+d.bee_range+'_'+d.background);
    
      const middle_of_group = (group) => {
            const middleIndex = Math.floor(group.length / 2);
            return group[middleIndex];
          }

      // Get the middle item from each group
      return Array.from(grouped.values(), middle_of_group);
    }
    if (input_tracks == null) {
      input_tracks = gui.tracks
    }
    let track = getMiddleDetections(input_tracks)
    return track
  }
  get_one_per_bee_id(input_tracks=null) {
    const gui = this
    function getMiddleDetections(tracks) {
      // Group by track_id using d3.group
      const grouped = d3.group(tracks, d => d.bee_id);
    
      const middle_of_group = (group) => {
            const middleIndex = Math.floor(group.length / 2);
            return group[middleIndex];
          }

      // Get the middle item from each group
      return Array.from(grouped.values(), middle_of_group);
    }
    if (input_tracks == null) {
      input_tracks = gui.tracks.filter( d => d.is_track_ref )
    }
    let track = getMiddleDetections(input_tracks)
    track = track.filter( d => d.bee_id != null )
    return track
  }
  get_ref_per_track() {
    let track = gui.tracks.filter( item => item.is_track_ref )
    return track
  }
  get_track_key_new() {
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

    let max = getMaxInteger( gui.tracks.map( d => String(d.track_key)) )
    let max2 = getMaxInteger( gui.tracks.map( d => String(d.track_key_orig)) )
    max = positiveMaxIgnoreNull(max,max2)
    const track_key = Number(max+1)
    return track_key
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

    let max = getMaxInteger( gui.tracks.map( d => String(d.bee_id)) )
    let max2 = getMaxInteger( gui.tracks.map( d => String(d.bee_id_orig)) )
    max = positiveMaxIgnoreNull(max,max2)
    const bee_id = Number(max+1)
    return bee_id
  }
  set_bee_attr(item, attr, value, propagate=true) { // Set bee_id for detail1
    item[attr] = value

    if (propagate) {
      this.propagate_bee_attr_to_track(item, attr)
      // Propagate calls rerender
    } else {
      // Rerender
      this.crop_gallery.update()
      this.crop_gallery2.update()
      this.details.render()
    }
  }
  propagate_bee_attr_to_track(item, attr) {

    console.log('propagate_bee_attr_to_track, from',item, attr)

    let track_key = item.track_key
    let value = item[attr]
    this.tracks.filter( d => d.track_key == track_key).forEach( item => item[attr]=value )

    this.crop_gallery.update()
    this.crop_gallery2.update()
    this.details.render()
  }
  set_bee_id(item, bee_id, source="manual") { // Set bee_id for detail1

    if ((item.bee_id_orig == null) && (item.bee_id != null)) // In case we started with initial ids, keep them as backup
      item.bee_id_orig = item.bee_id // Save original value (but do not overwrite if multiple edits). FIXME: proper undo stack

    item.bee_id = bee_id
    item.bee_id_src = source

    this.propagate_bee_id_to_track(item, source)
  }
  set_tracks_bee_id(selected_items, bee_id, source="manual") { // Set bee_id for detail1

    const selected_track_keys = [...new Set(selected_items.map( d => d.track_key ))]
    
    for (let item of this.tracks) {

      if (!selected_track_keys.includes(item.track_key)) continue;

      if ((item.bee_id_orig == null) && (item.bee_id != null)) // In case we started with initial ids, keep them as backup
        item.bee_id_orig = item.bee_id // Save original value (but do not overwrite if multiple edits). FIXME: proper undo stack

      item.bee_id = bee_id
      if (selected_items.includes(item)) {
        item.bee_id_src = source  // FIXME: state which item was actually selected
      } else {
        item.bee_id_src = 'track_prop,'+source
      }

    }
  }
  propagate_bee_id_to_track(item, source=null) {

    console.log('propagate_bee_id_to_track, from',item)

    function set_bee_id(item, bee_id, source="manual") { // Set bee_id for item
      if ((item.bee_id_orig == null) && (item.bee_id != null)) // In case we started with initial ids, keep them as backup
        item.bee_id_orig = item.bee_id // Save original value (but do not overwrite if multiple edits). FIXME: proper undo stack
      item.bee_id = bee_id
      item.bee_id_src = source
    }

    let track_key = item.track_key
    let bee_id = item.bee_id
    if (source == null)
      source = 'track_prop,key='+item.key
    gui.tracks.filter( d => d.track_key == track_key).forEach( item =>  set_bee_id(item, bee_id, source))

    // If bee_id has no ref, set the track ref as bee_id ref
    let has_ref = gui.tracks.reduce( (flag, d) => flag || ((d.bee_id == bee_id)&&(d.is_bee_id_ref)) , false )
    console.log(`bee_id=${bee_id}: has_ref=${has_ref}`)
    if (!has_ref) {
      let ref = gui.tracks.find( d => (d.track_key == track_key)&&(d.is_track_ref) )
      console.log(`new ref for bee_id=${bee_id}:`,ref)
      ref.is_bee_id_ref = true
    }

    this.crop_gallery.update()
    this.crop_gallery2.update()
    this.details.render()
  }

  propagate_bee_id_validation_to_tracks(items) {

    function set_bee_id(item, bee_id, source="manual") { // Set bee_id for item
      if ((item.bee_id_orig == null) && (item.bee_id != null)) // In case we started with initial ids, keep them as backup
        item.bee_id_orig = item.bee_id // Save original value (but do not overwrite if multiple edits). FIXME: proper undo stack
      item.bee_id = bee_id
      item.bee_id_src = source
    }

    track_keys = [...Set(items.map( item => item.track_key ))]

    track_keys.forEach( track_key => {
      let source = 'track_prop,key='+item.key
      gui.tracks.filter( d => d.track_key == track_key).forEach( item =>  set_bee_id(item, bee_id, source))
    })
    this.crop_gallery.update()
    this.crop_gallery2.update()
    this.details.render()
  }
}










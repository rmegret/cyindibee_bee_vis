var gdata

function createTable() {
   d3.select('#msg').html('createTable...')

    d3.select('#main').html('')

    let table = d3.select('#main').append('table')

    data = gdata.slice(0,100)

    // data/images/young-adults-blue-white-outside_2-1-32_batch_1.mp4.mp4.track000135.frame028491.png
    // data/images/young-adults-blue-white-in-lab-1-32_batch_1.mp4.track000028.frame001284.png
    // young-adults-blue-white-outside_1-1-32_batch_1.mp4.track000000.frame000158.png

    headers = ['color_id','track','frame','filename']

    table.append("thead").append("tr")
      .selectAll("th")
      .data(headers)
      .enter().append("th")
      .text(function(d) {
        return d;
        })
    let rows = table.append("tbody")
      .selectAll("tr")
      .data(data)
      .enter()
      .append("tr")

    for (col of headers) {
      if (col == 'filename') {
        rows.append("td") 
          .html(d => `<img src="${d[col]}" style='width:128px; height:128px;'/>`)
      } else if (col == 'color_id') {
        rows.append("td") 
          .html(d => `<a href='#' onclick="show_color_id('${d['color_id']}')">${d['color_id']}</a>`)
      } else {
        rows.append("td") //Name Cell
          .text(d => d[col])
      }
    }
    d3.select('#msg').html('createTable... done')
}

function show_color_id(color_id) {
    if (color_id === undefined) {
      color_id = 'green-blue'
    }

    d3.select('#msg').html('show_color_id...')

    d3.select('#main').html('')

    let table = d3.select('#main').append('table')

    data = gdata.filter(d => d.color_id == color_id)
    data = data.slice(0,100)

    // data/images/young-adults-blue-white-outside_2-1-32_batch_1.mp4.mp4.track000135.frame028491.png
    // data/images/young-adults-blue-white-in-lab-1-32_batch_1.mp4.track000028.frame001284.png
    // young-adults-blue-white-outside_1-1-32_batch_1.mp4.track000000.frame000158.png

    headers = ['color_id','track','frame','filename']

    table.append("thead").append("tr")
      .selectAll("th")
      .data(headers)
      .enter().append("th")
      .text(function(d) {
        return d;
        })
    let rows = table.append("tbody")
      .selectAll("tr")
      .data(data)
      .enter()
      .append("tr")

    for (col of headers) {
      if (col == 'filename') {
        rows.append("td") 
          .html(d => `<img src="${d[col]}" style='width:128px; height:128px;'/>`)
      } else {
        rows.append("td") //Name Cell
          .text(d => d[col])
      }
    }

    d3.select('#msg').html('show_color_id... done')
}

function show_group_by() {
    d3.select('#msg').html('show_group_by...')

    d3.select('#main').html('')

    //data = gdata.filter(d => d.color_id == color_id)
    data = gdata.slice(0,100)

    const groupedData = d3.group(gdata, d => d.color_id);

    // Render the groups directly from groupedData
    const groups = d3.select('#main')
        .selectAll('.group')
        .data(Array.from(groupedData), ([key, values]) => key) // Convert Map to array and use key as the data key
        .join('div')
        .attr('class', 'group');

    // Add a header for each group
    groups.append('h3')
    .attr('class', 'group-header')
    .html(([key]) => `<span class="triangle">▶</span> Group: ${key}`) // Add the triangle
    .style('cursor', 'pointer') // Make the header clickable
        .on('click', function(event, [key, values]) {
            // Toggle visibility of the group's children
            const groupDiv = d3.select(this.parentNode).select('.items');
            const isHidden = groupDiv.style('display') === 'none';
            groupDiv.style('display', isHidden ? 'flex' : 'none');
            
          // Update the triangle indicator
          const triangle = d3.select(this).select('.triangle');
          triangle.text(isHidden ? '▼' : '▶');
        });

    // Add a container for the group's items (initially hidden)
    groups.append('div')
        .attr('class', 'items')
        .style('display', 'none') // Initially collapsed
        .style('flex-wrap', 'nowrap') // Prevent wrapping of images
        .style('overflow-x', 'auto') // Add horizontal scrollbar if needed
        .style('white-space', 'nowrap') // Ensure images stay on one line
        .selectAll('.item-img')
        .data(([key, values]) => values) // Use the values (items) of each group
        .join('div')
        .attr('class', 'item-container')
        .style('text-align', 'center') // Center-align the content
        .each(function(d) {
          const container = d3.select(this);

          // Add the image
          container.append('img')
              .attr('src', d.filename)
              .attr('style', 'width:128px; height:128px; display:block; margin:auto;');

          // Add the track ID below the image
          container.append('div')
              .attr('class', 'track-id')
              .text(`Track #${d.track}`)
              .style('margin-top', '5px') // Add spacing above the text
              .style('font-size', '12px') // Adjust font size
              .style('color', '#555'); // Optional: Change text color
      });
  
      d3.select('#msg').html('show_group_by... done')
}

function show_group_by2() {
  d3.select('#msg').html('show_group_by2...')

  // Clear the existing content
  d3.select('#main').html('');

  // Group the data by 'color_id', then by 'track_id'
  const groupedData = d3.group(gdata, d => d.color_id, d => d.track);

  // Render the groups by 'color_id'
  const groups = d3.select('#main')
      .selectAll('.group')
      .data(Array.from(groupedData), ([key, values]) => key) // Convert Map to array and use key as the data key
      .join('div')
      .attr('class', 'group');

  // Add a header for each 'color_id' group
  groups.append('h3')
  .attr('class', 'group-header')
  .html(([key]) => `<span class="triangle">▶</span> Group: ${key}`) // Add the triangle
  .style('cursor', 'pointer') // Make the header clickable
      .on('click', function(event, [key, values]) {
          // Toggle visibility of the group's children
          const groupDiv = d3.select(this.parentNode).select('.items');
          const isHidden = groupDiv.style('display') === 'none';
          groupDiv.style('display', isHidden ? 'block' : 'none');
          
        // Update the triangle indicator
        const triangle = d3.select(this).select('.triangle');
        triangle.text(isHidden ? '▼' : '▶');
      });

  // Add a container for the 'track_id' rows (initially hidden)
  groups.append('div')
      .attr('class', 'items')
      .style('display', 'none') // Initially collapsed
      .selectAll('.track-row')
      .data(([key, tracks]) => Array.from(tracks), ([trackId, items]) => trackId) // Convert inner Map to array
      .join('div')
      .attr('class', 'track-row')
      .style('flex-wrap', 'nowrap') // Prevent wrapping of images
      .style('overflow-x', 'auto') // Add horizontal scrollbar if needed
      .style('white-space', 'nowrap') // Ensure images stay on one line
      .style('margin-bottom', '10px') // Add spacing between rows
      .each(function([trackId, items]) {
          const trackRow = d3.select(this);

          // Add a header for each 'track_id'
          trackRow.append('h4')
              .text(`Track ID: ${trackId}`)
              .style('margin', '5px 0') // Add spacing above and below the header
              .style('font-size', '14px')
              .style('color', '#333');

          // Add a container for the images in this 'track_id'
          trackRow.append('div')
              .attr('class', 'track-items')
              .style('display', 'flex') // Use flexbox for horizontal layout
              .style('flex-wrap', 'nowrap') // Prevent wrapping of images
              .style('overflow-x', 'auto') // Add horizontal scrollbar if needed
              .style('white-space', 'nowrap') // Ensure images stay on one line
              .selectAll('.item-container')
              .data(items) // Use the items in this 'track_id'
              .join('div')
              .attr('class', 'item-container')
              .style('text-align', 'center') // Center-align the content
              .style('margin', '5px') // Add some spacing between items
              .each(function(d) {
                  const container = d3.select(this);

                  //let crop = 'position:absolute; clip: rect(16px, 92px, 80px, 32px); top:-16px; left:-32px;'

                  // Add the image
                  container
                      //.append('div')
                      //.attr('style', 'width:64px; height:64px; display:block; margin:auto; overflow:hidden; position:relative;')
                      .append('img')
                      .attr('src', d.filename)
                      .attr('style', 'width:128px; height:128px; display:block; margin:auto;');

                  // Add the frame ID below the image
                  container.append('div')
                      .attr('class', 'frame-id')
                      .text(`Frame: ${d.frame}`)
                      .style('margin-top', '5px') // Add spacing above the text
                      .style('font-size', '12px') // Adjust font size
                      .style('color', '#555'); // Optional: Change text color
              });
      });
      d3.select('#msg').html('show_group_by2... done')
}

//D = d3.csv('data/batch1_dataframe.csv')
D = d3.csv('data/summer_bee_dataset_open_train_bee_64_ids_batch1_sample_num_max.csv')
  .then(_data => {
    console.log('Loaded data:',_data);
    gdata = _data

    for (i in gdata) {
      let item = gdata[i]
      //console.log(item)
      //item['filename'] = item['filename'].replace('.jpg', '.png');
      try {
        item['filename'] = item['new_filepath'].replace('/home/lmeyers/summer_bee_data_reextract/','/data/')
      } catch {}
    }

    createTable()
    //show_group_by2()
  })
  .catch(error => {
    console.error('Error loading the data', error);
  });

  
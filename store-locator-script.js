    // Mapbox token
    mapboxgl.accessToken = 'pk.eyJ1Ijoicm9ja2xhbmQtY2VvIiwiYSI6ImNsbHI5dHU3aTBrOGY0bG0yb2RrMTd6ZGYifQ.1dMr1yO7WZW3zlQA25H46Q';

    // Initialize the map
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/rockland-ceo/clltjtmy7004o01rcgz1i8z6h',
        center: [-118.239364, 34.058241],
        zoom: 7,
        cooperativeGestures: true
    });

    map.addControl(new mapboxgl.FullscreenControl());

    // Constants
    const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/1n8emJif1ErvRCM_Mn0UBIUGhYY8RNYdrN4aQaZTSoNY/gviz/tq?tqx=out:csv&sheet=Off-Premise-Accounts";

    // Event Listeners
    $(document).ready(function() {
        setupEventListeners();
    });

    function setupEventListeners() {
        $("#find-nearest-button").on("click", showSearchInput);
        $("#search-button").on("click", handleSearchButtonClick);
        $(".close-block").on('click', hideLocationInfo);
    }

    function showSearchInput(e) {
        e.preventDefault();
        $(".map-search-input-wrapper").css("display", "flex");
    }

    function handleSearchButtonClick(e) {
        e.preventDefault();
        $(".map-search-input-wrapper").css("display", "none");
        searchNearestLocation();
    }

    function searchNearestLocation() {
        const userAddress = $("#address-input").val();
        if (!userAddress) {
            alert("Please enter an address.");
            return;
        }

        geocodeAddress(userAddress, function(error, coords) {
            if (error) {
                alert("Error geocoding address: " + error);
                return;
            }

            const locationsSource = map.getSource('locations');
            if (!locationsSource) {
                alert("Locations data hasn't loaded yet. Please try again in a few seconds.");
                return;
            }

            const nearestLocation = findNearestLocation(coords, locationsSource._data.features);
            if (nearestLocation) {
                handleMarkerTap(nearestLocation);
                map.flyTo({
                    center: nearestLocation.geometry.coordinates,
                    zoom: 12
                });
            } else {
                alert('No nearby locations found.');
            }
        });
    }

    function handleMarkerTap(feature) {
        const locationData = feature.properties;

        // Log for debugging purposes
        console.log("Tapped feature:", feature);
        console.log("Location data:", locationData);
        console.log("ID:", locationData['Array ID']);

        // Map each element in the .locations-map_item div to the corresponding data from the CSV
        $(".location-image").attr("src", locationData["Customer Profile Image"]);
        $(".card_heading").text(locationData["Customer Name"]);
        $(".locations-map_city").text(locationData["City"]);
        $(".location_street-address").text(locationData["Street"]);
        $(".location-city_block").text(locationData["City"]); // Reused the same "City" header as per your list
        $(".location-zip_block").text(locationData["Zip"]);
        $(".card_link-block_phone").attr("href", "tel:" + locationData["Phone URL"]);
        $(".card_link-text-block_phone").text(locationData["Phone"]);
        $(".card_link-block_directions").attr("href", locationData["Google Maps URL"]);
        $(".card_link-text-directions").text("Get Directions");
        $(".card_description").html(locationData["Customer Details"]);

        // Show or hide the description wrapper based on the presence of customer details
        $(".location-description_wrapper").toggle(locationData["Customer Details"].trim() !== "");

        // Show or hide the phone link based on the presence of a phone URL
        $(".card_link-block_phone").toggle(locationData["Phone URL"].trim() !== "");

        // Show the .locations-map_item
        $(".locations-map_item, .locations-map_wrapper").addClass("is--show");
    }

    function processCSVData(data) {
        // Error handling for CSV parsing
        const parsedCSV = Papa.parse(data, {
            header: true,
            skipEmptyLines: true
        });

        if (parsedCSV.errors.length > 0) {
            console.error("Errors parsing CSV data: ", parsedCSV.errors);
            alert("There was an error processing location data. Please notify the website administrator.");
            return null;
        }

        // Error handling for data integrity
        const requiredColumns = ["Latitude", "Longitude", "Customer Profile Image", "Customer Name", "City", "Street", "Zip", "Phone URL", "Phone", "Google Maps URL", "Customer Details"];
        const missingColumns = requiredColumns.filter(column => !parsedCSV.meta.fields.includes(column));

        if (missingColumns.length > 0) {
            console.error("Missing essential columns in CSV data: ", missingColumns);
            alert("There's an issue with the location data structure. Please notify the website administrator.");
            return null;
        }

        let geojsonData = {
            type: 'FeatureCollection',
            features: []
        };

        parsedCSV.data.forEach(row => {
            geojsonData.features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(row.Longitude), parseFloat(row.Latitude)]
                },
                properties: row // This line adds all columns from your CSV as properties
            });
        });

        return geojsonData;
    }

            // Function to fetch or retrieve cached CSV data
            function fetchOrRetrieveCSVData(url, callback) {
                // Check if data is in localStorage
                const cachedData = localStorage.getItem('cachedCSVData');
                
                if (cachedData) {
                    console.log('Using cached data.');
                    callback(cachedData); // Use cached data
                    return;
                }

                // Fetch data if not in localStorage
                $.get(url, function(data) {
                    console.log('Fetching new data.');
                    localStorage.setItem('cachedCSVData', data); // Cache the data
                    callback(data); // Use the fetched data
                });
            }

            // Your existing function, modified to use the caching mechanism
            function fetchAndDisplayCSVData() {
                fetchOrRetrieveCSVData(GOOGLE_SHEETS_CSV_URL, function(data) {
                    const geojsonData = processCSVData(data);
                    if (!geojsonData) return;

                    // Add the geojson data as a source to the map
                    map.addSource('locations', {
                        'type': 'geojson',
                        'data': geojsonData,
                        'cluster': true,
                        'clusterRadius': 50
                    });
                });
            }


            // Adjust the map's viewport to fit the bounds of the data
            let bounds = new mapboxgl.LngLatBounds();
            geojsonData.features.forEach(function(feature) {
                bounds.extend(feature.geometry.coordinates);
            });
            map.fitBounds(bounds, {
                padding: 20
            });

            // Add navigation controls to the map
            map.addControl(new mapboxgl.NavigationControl());

            // Define the cluster layer
            map.addLayer({
                'id': 'clusters',
                'type': 'circle',
                'source': 'locations',
                'filter': ['has', 'point_count'],
                'paint': {
                    'circle-color': '#1a3c34',
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        20,  // circle radius for cluster count = 20
                        100, // circle radius for cluster count = 100
                        30,  // circle radius for cluster count = 30
                        750, // circle radius for cluster count = 750
                        40   // circle radius for cluster count = 40
                    ]
                }
            });

            // Define the cluster count labels
            map.addLayer({
                'id': 'cluster-count',
                'type': 'symbol',
                'source': 'locations',
                'filter': ['has', 'point_count'],
                'layout': {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['Arial Unicode MS Bold'],
                    'text-size': 12
                },
                'paint': {
                    'text-color': '#f1e4b2'
                }
            });

            // Load custom marker and define individual locations layer
            map.loadImage('https://uploads-ssl.webflow.com/63a8b8d4f3ba371ef3eca92c/64eb74f60202b90fc8998067_skydusterAsset%201map-marker.png', function(error, image) {
                if (error) throw error;
                map.addImage('custom-marker', image);

                map.addLayer({
                    'id': 'locations',
                    'type': 'symbol',
                    'source': 'locations',
                    'filter': ['!', ['has', 'point_count']],
                    'layout': {
                        'icon-image': 'custom-marker',
                        'icon-size': 0.35
                    }
                });
            });

            // Set up click interactions for clusters
            map.on('click', 'clusters', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['clusters']
                });
                const clusterId = features[0].properties.cluster_id;
                map.getSource('locations').getClusterExpansionZoom(
                    clusterId,
                    (err, zoom) => {
                        if (err) return;
                        map.easeTo({
                            center: features[0].geometry.coordinates,
                            zoom: zoom
                        });
                    }
                );
            });

            // Set up click interactions for individual locations
            map.on('click', 'locations', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['locations']
                });
                if (features.length) {
                    handleMarkerTap(features[0]);
                }
            });

            // Hide location details when clicking outside of any location
            map.on('click', function(e) {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['locations']
                });
                if (!features.length) {
                    $(".locations-map_item, .locations-map_wrapper").removeClass("is--show");
                }
            });

            // Hide the default Mapbox attribution and add your custom image
            $('.mapboxgl-ctrl-attrib').hide();
            $('.mapboxgl-ctrl-bottom-right').append('<img src="https://uploads-ssl.webflow.com/63a8b8d4f3ba371ef3eca92c/63a8d6cef3af9936f047f013_SD-Logo_HORIZONTAL_GreenAsset%201.svg" alt="Skyduster Dark Logo" class="custom-map-image">');
        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Error fetching data: ", textStatus, errorThrown);
            alert("There was an error fetching location data. Please try again later.");
        });
    }

    function geocodeAddress(address, callback) {
        // Construct the URL for Mapbox's Geocoding API
        const geocodingURL = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`;

        // Send a request to the geocoding service
        $.getJSON(geocodingURL, function(data) {
            // If there are results, return the coordinates of the first result
            if (data.features && data.features.length) {
                callback(null, data.features[0].geometry.coordinates);
            } else {
                callback('No results found');
            }
        }).fail(function() {
            callback('Error accessing geocoding service');
        });
    }

    function findNearestLocation(userCoords, locations) {
        let nearestLocation;
        let nearestDistance = Infinity;

        // Iterate through each location to find the nearest one
        locations.forEach(location => {
            const locationCoords = location.geometry.coordinates;
            // Calculate the distance between the user's coordinates and the current location's coordinates
            const distance = turf.distance(turf.point(userCoords), turf.point(locationCoords));

            // If this location is nearer than the previously found nearest location, update the nearest location and distance
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestLocation = location;
            }
        });

        // Return the nearest location
        return nearestLocation;
    }

    function hideLocationInfo() {
        $(".locations-map_item, .locations-map_wrapper").removeClass("is--show");
    }

    // After the map is loaded
    map.on('load', function() {
        fetchAndDisplayCSVData();
    });
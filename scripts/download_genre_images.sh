#!/bin/bash

# Create the genres directory if it doesn't exist
mkdir -p public/images/genres

# Download genre images from Unsplash
curl -o public/images/genres/rock.jpg "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80"
curl -o public/images/genres/pop.jpg "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80"
curl -o public/images/genres/jazz.jpg "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80"
curl -o public/images/genres/blues.jpg "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80"
curl -o public/images/genres/folk.jpg "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80"
curl -o public/images/genres/country.jpg "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80"
curl -o public/images/genres/rnb.jpg "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80"
curl -o public/images/genres/hiphop.jpg "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80" 
const fs = require('fs');
const path = './src/data/properties.json'; // adjust path if needed

const typeImageMap = {
  "House": [
    "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
    "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914"
  ],
  "Flat": [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2"
  ],
  "Studio": [
    "https://images.unsplash.com/photo-1554995207-c18c203602cb",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7"
  ],
  "Room with Own Bathroom": [
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14"
  ],
  "Single room": [
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14"
  ],
  "Cottage": [
    "https://images.unsplash.com/photo-1518780664697-55e3ad937233",
    "https://images.unsplash.com/photo-1449844908441-8829872d2607",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9"
  ],
  "Back room": [
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7"
  ],
  "Garden Flat": [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
    "https://images.unsplash.com/photo-1554995207-c18c203602cb"
  ],
  "Two-room unit": [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688"
  ],
  "Bachelor Flat": [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
    "https://images.unsplash.com/photo-1554995207-c18c203602cb",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85"
  ]
};

// Fallback for unknown types (use generic room)
const fallbackImages = [
  "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af",
  "https://images.unsplash.com/photo-1540518614846-7eded433c457",
  "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14"
];

const raw = fs.readFileSync(path, 'utf-8');
const data = JSON.parse(raw);

data.properties = data.properties.map(property => {
  const type = property.type || '';
  const images = typeImageMap[type] || fallbackImages;
  return { ...property, images };
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
console.log(`✅ Added images to ${data.properties.length} properties.`);
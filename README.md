# Real-Time Location Tracker

A real-time location tracking application built with Next.js, Socket.IO, and Leaflet. Share your location with other users in real-time and see their positions on an interactive map.

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Real-time:** Socket.IO (client & server)
- **Maps:** Leaflet.js with OpenStreetMap tiles
- **Styling:** Tailwind CSS
- **Geolocation:** Browser Geolocation API

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Modern browser with geolocation support

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd location_tracker
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

### Environment Variables

#### Development (Optional)

Create a `.env.local` file in the root directory for custom configuration:

```env
# Socket.IO Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Geolocation Settings
NEXT_PUBLIC_GEOLOCATION_HIGH_ACCURACY=true
NEXT_PUBLIC_GEOLOCATION_MAX_AGE=10000
NEXT_PUBLIC_GEOLOCATION_TIMEOUT=15000

# Map Configuration
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_ATTRIBUTION=© OpenStreetMap contributors

# Location Data Settings
NEXT_PUBLIC_LOCATION_DATA_EXPIRY=30000
```

#### Production Deployment

Set these environment variables in your hosting platform:

```env
# Required for production
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://yourdomain.com

# Optional: Custom domain (if different from NEXT_PUBLIC_SITE_URL)
DOMAIN_URL=https://www.yourdomain.com

# Vercel automatically provides this
VERCEL_URL=your-project.vercel.app
```

## Usage

### Basic Usage

1. **Allow location access** when prompted by your browser
2. **View your location** on the map (blue marker)
3. **See other users** who are connected (red markers)
4. **Use map controls:**
   - **North indicator** (top-right): Reset map rotation to north
   - **Refresh button** (bottom-right): Refresh your location

### Multi-User Testing

1. **Open multiple browser tabs** or windows
2. **Allow location access** in each tab
3. **See real-time updates** as users move around

### Map Controls

- **Zoom:** Mouse wheel or pinch gestures
- **Pan:** Click and drag
- **Reset rotation:** Click the north indicator button
- **Refresh location:** Click the refresh button

## API Endpoints

### `/api/socket`

- **Method:** GET
- **Purpose:** Initialize Socket.IO server
- **Response:** Server setup confirmation

### `/api/status`

- **Method:** GET
- **Purpose:** Check server health
- **Response:** Server status and uptime

## Socket.IO Events

### Client to Server

- `send-location` - Send current GPS coordinates

### Server to Client

- `connected` - Connection confirmation
- `receive-location` - Location update from other users
- `user-disconnected` - User left notification

## Configuration Options

### Geolocation Settings

- `NEXT_PUBLIC_GEOLOCATION_HIGH_ACCURACY` - Enable high accuracy mode
- `NEXT_PUBLIC_GEOLOCATION_MAX_AGE` - Maximum age of cached location (ms)
- `NEXT_PUBLIC_GEOLOCATION_TIMEOUT` - Location request timeout (ms)

### Map Settings

- `NEXT_PUBLIC_MAP_TILE_URL` - Custom map tile provider URL
- `NEXT_PUBLIC_MAP_ATTRIBUTION` - Map attribution text

### Location Data

- `NEXT_PUBLIC_LOCATION_DATA_EXPIRY` - How long to keep location data (ms)

## Browser Support

- ✅ Chrome 50+
- ✅ Firefox 55+
- ✅ Safari 10+
- ✅ Edge 12+

**Note:** HTTPS is required for geolocation in production. Localhost is allowed for development.

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Key Features Implementation

1. **Real-time Communication:** Socket.IO handles bidirectional communication
2. **Map Integration:** Leaflet.js provides interactive map functionality
3. **Geolocation:** Browser Geolocation API for GPS coordinates
4. **Error Handling:** Comprehensive error handling and user feedback
5. **Responsive Design:** Tailwind CSS for mobile-friendly interface

## Troubleshooting

### Common Issues

1. **Location not working:**

   - Check browser permissions
   - Ensure HTTPS in production
   - Verify geolocation is enabled

2. **Socket connection errors:**

   - Check if server is running
   - Verify network connectivity
   - Check browser console for errors

3. **Map not loading:**
   - Check internet connection
   - Verify Leaflet library loading
   - Check browser console for errors

### Debug Information

- Check browser console for detailed error messages
- Monitor network tab for failed requests
- Verify Socket.IO connection status in console logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Leaflet](https://leafletjs.com/) - Open-source JavaScript library for mobile-friendly interactive maps
- [Socket.IO](https://socket.io/) - Real-time bidirectional event-based communication
- [OpenStreetMap](https://www.openstreetmap.org/) - Free world map data
- [Next.js](https://nextjs.org/) - React framework for production

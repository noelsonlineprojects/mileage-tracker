'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { LoadScript, Autocomplete } from '@react-google-maps/api'

const libraries: ('places')[] = ['places']

const OFFICE_ADDRESS = '2004 W Garden St, Pensacola, FL 32502, USA'

export default function Home() {
  const [trips, setTrips] = useState<any[]>([])
  const [date, setDate] = useState('')
  const [startAddress, setStartAddress] = useState(OFFICE_ADDRESS)
  const [endAddress, setEndAddress] = useState('')
  const [miles, setMiles] = useState('')
  const [purpose, setPurpose] = useState('')
  const [isRoundTrip, setIsRoundTrip] = useState(false)

  const startAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const endAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    fetchTrips()
  }, [])

  async function fetchTrips() {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('date', { ascending: false })
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
    if (error) console.error(error)
    else setTrips(data || [])
  }

  function getRecentPlaces() {
    const addresses = trips.flatMap((t) => [t.start_address, t.end_address])
    const unique = Array.from(new Set(addresses)).filter((a) => a && a !== OFFICE_ADDRESS)
    return unique.slice(0, 5)
  }

  function calculateDistance(origin: string, destination: string) {
    if (!origin || !destination) return
    const service = new google.maps.DistanceMatrixService()
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      },
      (response, status) => {
        if (status === 'OK' && response) {
          const element = response.rows[0].elements[0]
          if (element.status === 'OK') {
            const meters = element.distance.value
            const calculatedMiles = (meters / 1609.34).toFixed(1)
            setMiles(calculatedMiles)
          }
        }
      }
    )
  }

  function onStartPlaceChanged() {
    const place = startAutocompleteRef.current?.getPlace()
    if (place?.formatted_address) {
      setStartAddress(place.formatted_address)
      if (endAddress) calculateDistance(place.formatted_address, endAddress)
    }
  }

  function onEndPlaceChanged() {
    const place = endAutocompleteRef.current?.getPlace()
    if (place?.formatted_address) {
      setEndAddress(place.formatted_address)
      if (startAddress) calculateDistance(startAddress, place.formatted_address)
    }
  }

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()

  const submittedAt = new Date().toISOString()

  const rowsToInsert = [
    {
      date,
      start_address: startAddress,
      end_address: endAddress,
      miles: parseFloat(miles),
      purpose,
      submitted_at: submittedAt,
    },
  ]

  if (isRoundTrip) {
    rowsToInsert.push({
      date,
      start_address: endAddress,
      end_address: startAddress,
      miles: parseFloat(miles),
      purpose: purpose ? `${purpose} (return)` : 'Return trip',
      submitted_at: submittedAt,
    })
  }

    const { error } = await supabase.from('trips').insert(rowsToInsert)

    if (error) {
      console.error(error)
      alert('Error saving trip')
    } else {
      setDate('')
      setStartAddress('')
      setEndAddress('')
      setMiles('')
      setPurpose('')
      setIsRoundTrip(false)
      fetchTrips()
    }
  }

  function exportCSV() {
    const headers = ['Date', 'From', 'To', 'Miles', 'Purpose']
    const rows = trips.map((t) => [t.date, t.start_address, t.end_address, t.miles, t.purpose || ''])
    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mileage-report-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={libraries}
    >
      <main style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        <h1>Mileage Tracker</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <Autocomplete
            onLoad={(ac) => (startAutocompleteRef.current = ac)}
            onPlaceChanged={onStartPlaceChanged}
          >
            <input
              type="text"
              placeholder="Start address"
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
              required
            />
          </Autocomplete>

          <Autocomplete
            onLoad={(ac) => (endAutocompleteRef.current = ac)}
            onPlaceChanged={onEndPlaceChanged}
          >
            <input
              type="text"
              placeholder="End address"
              value={endAddress}
              onChange={(e) => setEndAddress(e.target.value)}
              required
            />
          </Autocomplete>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {getRecentPlaces().map((place) => (
    <button
      key={place}
      type="button"
      onClick={() => {
  setEndAddress(place)
  calculateDistance(startAddress, place)
}}
      style={{ fontSize: 12, padding: '4px 8px' }}
    >
      {place.split(',')[0]}
    </button>
  ))}
</div>

          <input type="number" step="0.1" placeholder="Miles" value={miles} onChange={(e) => setMiles(e.target.value)} required />
          <input type="text" placeholder="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={isRoundTrip}
              onChange={(e) => setIsRoundTrip(e.target.checked)}
            />
            Return to start address? (logs the trip back too, same mileage)
          </label>

          <button type="submit">Add Trip</button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>Trips</h2>
          <button onClick={exportCSV} type="button">Export CSV</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>From</th>
              <th style={{ textAlign: 'left' }}>To</th>
              <th style={{ textAlign: 'left' }}>Miles</th>
              <th style={{ textAlign: 'left' }}>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id}>
                <td>{trip.date}</td>
                <td>{trip.start_address}</td>
                <td>{trip.end_address}</td>
                <td>{trip.miles}</td>
                <td>{trip.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </LoadScript>
  )
}
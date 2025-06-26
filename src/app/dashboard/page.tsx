'use client'

import { useEffect, useState } from 'react'

interface Stats {
  today: {
    totalStaff: number
    presentToday: number
    attendanceRate: string
    currentlyIn: number
  }
  recentActivity: Array<{
    name: string
    employee_id: string
    department: string
    check_in_time: string
    check_out_time?: string
    date: string
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [loginResult, setLoginResult] = useState('')
  const [checkinResult, setCheckinResult] = useState('')

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const testLogin = async () => {
    const emailInput = document.getElementById('loginEmail') as HTMLSelectElement
    const passwordInput = document.getElementById('loginPassword') as HTMLInputElement
    
    const email = emailInput.value
    const password = passwordInput.value

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await response.json()
      
      if (data.success) {
        setLoginResult(`✅ ការចូលម៉ូតាបេសបានជោគជ័យ! សូមស្វាគមន៍ ${data.data.user.name}`)
      } else {
        setLoginResult('❌ ' + data.error)
      }
    } catch (error) {
      setLoginResult('❌ កំហុស: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const testCheckin = async () => {
    const latInput = document.getElementById('latitude') as HTMLInputElement
    const lonInput = document.getElementById('longitude') as HTMLInputElement
    const notesInput = document.getElementById('notes') as HTMLInputElement
    const staffInput = document.getElementById('staffId') as HTMLSelectElement

    const latitude = parseFloat(latInput.value)
    const longitude = parseFloat(lonInput.value)
    const notes = notesInput.value
    const staffId = staffInput.value

    try {
      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, notes, staff_id: parseInt(staffId) })
      })
      const data = await response.json()
      
      if (data.success) {
        setCheckinResult(`✅ ${data.message} ចម្ងាយ: ${data.data.location.distance.toFixed(1)}ម៉ែត្រ`)
        loadStats()
      } else {
        setCheckinResult('❌ ' + data.message)
      }
    } catch (error) {
      setCheckinResult('❌ កំហុស: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div style={{ fontFamily: 'Khmer OS, sans-serif' }} className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-4">
            🏢 ប្រព័ន្ធអត្តដ្ឋានម៉ូបាយ
          </h1>
          <p className="text-gray-600 text-lg mb-4">
            ការភ្ជាប់ពេញលេញជាមួយម៉ូតាបេស PostgreSQL
          </p>
          <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
            ✅ បានដាក់ឱនឡាញនៅលើ Vercel
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-6 mb-8">
          <h4 className="text-xl font-bold text-blue-800 mb-4">🔑 គណនីសាកល្បងម៉ូតាបេស</h4>
          <p><strong>អ្នកគ្រប់គ្រង:</strong> admin@company.com / password123</p>
          <p><strong>បុគ្គលិក:</strong> john.doe@company.com / password123</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              📊 ស្ថិតិម៉ូតាបេសផ្ទាល់
            </h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">កំពុងផ្ទុកស្ថិតិ...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats?.today?.totalStaff || '-'}
                  </div>
                  <div className="text-sm text-gray-600">បុគ្គលិកទាំងអស់</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats?.today?.presentToday || '-'}
                  </div>
                  <div className="text-sm text-gray-600">មានវត្តមានថ្ងៃនេះ</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {stats?.today?.attendanceRate || '-'}%
                  </div>
                  <div className="text-sm text-gray-600">អត្រាវត្តមាន</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {stats?.today?.currentlyIn || '-'}
                  </div>
                  <div className="text-sm text-gray-600">កំពុងនៅការិយាល័យ</div>
                </div>
              </div>
            )}

            <button 
              onClick={loadStats}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
            >
              🔄 ធ្វើឲ្យស្ថិតិទាន់សម័យ
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              🔐 សាកល្បងការផ្ទៀងផ្ទាត់
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">អុីមែល</label>
                <select id="loginEmail" className="w-full p-3 border border-gray-300 rounded-lg">
                  <option value="admin@company.com">admin@company.com (អ្នកគ្រប់គ្រង)</option>
                  <option value="john.doe@company.com">john.doe@company.com (អ្នកអភិវឌ្ឍ)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">លេខសម្ងាត់</label>
                <input 
                  type="password" 
                  id="loginPassword" 
                  defaultValue="password123"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>

              <button 
                onClick={testLogin}
                className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors"
              >
                🔓 សាកល្បងចូលម៉ូតាបេស
              </button>

              {loginResult && (
                <div className={`p-4 rounded-lg ${loginResult.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {loginResult}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            📍 ការចូលដោយភូមិសាស្ត្រ
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="mb-4"><strong>ទីតាំងការិយាល័យ:</strong> 11.55187745723682, 104.92836774000962</p>
              <p className="mb-4"><strong>ប្រវែងកម្រិតភូមិសាស្ត្រ:</strong> 10 ម៉ែត្រ</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">រយៈទទឹង</label>
                  <input 
                    type="number" 
                    id="latitude" 
                    defaultValue="11.55187745723682"
                    step="0.000001"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">រយៈបណ្ដោយ</label>
                  <input 
                    type="number" 
                    id="longitude" 
                    defaultValue="104.92836774000962"
                    step="0.000001"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">លេខសម្គាល់បុគ្គលិក</label>
                  <select id="staffId" className="w-full p-3 border border-gray-300 rounded-lg">
                    <option value="1">1 - អ្នកគ្រប់គ្រង</option>
                    <option value="2">2 - John Doe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">កំណត់ចំណាំ</label>
                  <input 
                    type="text" 
                    id="notes" 
                    placeholder="កំណត់ចំណាំការចូលការិយាល័យ"
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={testCheckin}
                className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors"
              >
                ✅ ចូលការិយាល័យម៉ូតាបេស
              </button>

              <button 
                onClick={() => {
                  const latInput = document.getElementById('latitude') as HTMLInputElement
                  const lonInput = document.getElementById('longitude') as HTMLInputElement
                  latInput.value = '11.6'
                  lonInput.value = '105.0'
                  testCheckin()
                }}
                className="w-full bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                ❌ សាកល្បងនៅក្រៅភូមិសាស្ត្រ
              </button>

              {checkinResult && (
                <div className={`p-4 rounded-lg ${checkinResult.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {checkinResult}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">🚀 លក្ខណៈពិសេសប្រព័ន្ធ</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-4xl mb-3">🗄️</div>
              <h4 className="font-semibold text-gray-800">PostgreSQL</h4>
              <p className="text-sm text-gray-600">ការភ្ជាប់ម៉ូតាបេសពិត</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-4xl mb-3">🔐</div>
              <h4 className="font-semibold text-gray-800">ការផ្ទៀងផ្ទាត់</h4>
              <p className="text-sm text-gray-600">ប្រព័ន្ធចូលសុវត្ថិភាព</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-4xl mb-3">📍</div>
              <h4 className="font-semibold text-gray-800">ភូមិសាស្ត្រ</h4>
              <p className="text-sm text-gray-600">ការចូលតាមទីតាំង</p>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-4xl mb-3">☁️</div>
              <h4 className="font-semibold text-gray-800">Vercel</h4>
              <p className="text-sm text-gray-600">ដាក់ឱនឡាញលើ Cloud</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
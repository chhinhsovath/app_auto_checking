import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-4">
            🏢 Mobile Attendance System
          </h1>
          <p className="text-gray-600 text-lg mb-4">
            Comprehensive attendance management with geofencing capabilities
          </p>
          <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
            ✅ Deployed on Vercel
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">🚀 Features</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✅ Real-time geofencing (10m radius)</li>
              <li>✅ Digital Ocean PostgreSQL</li>
              <li>✅ Mobile app (React Native/Expo)</li>
              <li>✅ Khmer language support</li>
              <li>✅ Serverless deployment</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">🔗 Quick Access</h3>
            <div className="space-y-3">
              <Link 
                href="/dashboard" 
                className="block bg-blue-50 hover:bg-blue-100 p-3 rounded-lg transition-colors"
              >
                <strong>📊 Dashboard</strong>
                <p className="text-sm text-gray-600">Main admin panel</p>
              </Link>
              <Link 
                href="/api/health" 
                className="block bg-green-50 hover:bg-green-100 p-3 rounded-lg transition-colors"
              >
                <strong>🏥 API Health</strong>
                <p className="text-sm text-gray-600">System status</p>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">🔑 Demo Access</h3>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm"><strong>Email:</strong> admin@company.com</p>
              <p className="text-sm"><strong>Password:</strong> password123</p>
              <p className="text-xs text-gray-600 mt-2">
                Use for mobile app and dashboard testing
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📱 Mobile App</h2>
          <p className="text-gray-600 mb-4">
            The mobile app is built with Expo/React Native and connects to this Vercel deployment.
          </p>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>📲 Download:</strong> APK available from EAS build dashboard
            </p>
            <p className="text-sm text-orange-800">
              <strong>🌐 API:</strong> Automatically connects to this Vercel deployment
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
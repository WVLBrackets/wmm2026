import { siteConfig } from '@/config/site';
import { CreditCard, DollarSign, Users, Heart, AlertCircle, CheckCircle } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Main Payment Content */}
        <div className="space-y-8">
          {/* Help Request Section */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-6 w-6 text-yellow-600 mr-3 mt-1" />
              <div>
                <h2 className="text-lg font-semibold text-yellow-800 mb-2">
                  Your Help is Appreciated!
                </h2>
                <p className="text-yellow-700">
                  This is the one part that isn&apos;t automated, so the more you can help me out, 
                  the more I&apos;ll appreciate it!!
                </p>
              </div>
            </div>
          </div>

          {/* Entry Fee Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <DollarSign className="h-8 w-8 text-green-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Entry Fee</h2>
            </div>
            
            <div className="bg-green-50 rounded-lg p-6 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600 mb-2">$5 per entry</p>
                <p className="text-gray-700">Enter as many times as you like!</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-1" />
                <p className="text-gray-700">
                  <strong>Group Payments:</strong> If you are playing with a group of people, 
                  please batch your payments together as much as possible.
                </p>
              </div>
              
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-1" />
                <p className="text-gray-700">
                  <strong>Player List:</strong> Be sure to include a list of the players that 
                  are being paid for when you submit any payment.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Methods Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <CreditCard className="h-8 w-8 text-blue-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Payment Methods</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Electronic Payments */}
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <CreditCard className="h-6 w-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Electronic Payments</h3>
                </div>
                <p className="text-gray-700 mb-4">
                  Electronic payments are fine. Just be sure you are following the 
                  Terms & Conditions of the platform you are using.
                </p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Venmo</p>
                  <p>• PayPal</p>
                  <p>• Zelle</p>
                  <p>• Bank Transfer</p>
                  <p>• Other digital platforms</p>
                </div>
              </div>

              {/* Cash Payments */}
              <div className="bg-green-50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <DollarSign className="h-6 w-6 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Cash</h3>
                </div>
                <p className="text-gray-700">
                  Cash is welcome if you plan to see me or if you live nearby.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Tips Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <Users className="h-8 w-8 text-purple-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Payment Tips</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">For Groups:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Designate one person to collect and submit payments
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Include all player names in the payment note
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Submit payments together to reduce processing
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">For Individuals:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Include your name in the payment note
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Use the same name as your bracket entry
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Submit payment before the deadline
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <Heart className="h-8 w-8 text-red-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Questions?</h2>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 mb-4">
                If you have any questions about payments or need help with the process, 
                don&apos;t hesitate to reach out!
              </p>
              <p className="text-sm text-gray-600">
                Remember: The more you can help streamline the payment process, 
                the more time I can spend on making the tournament experience great for everyone!
              </p>
            </div>
          </div>

          {/* Enjoy Section */}
          <div className="text-center bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Enjoy!</h2>
            <p className="text-lg text-gray-600">
              Thanks for your participation and for making the payment process as smooth as possible!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

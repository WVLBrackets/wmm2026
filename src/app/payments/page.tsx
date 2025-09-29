import { CreditCard, DollarSign, Heart, CheckCircle } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Main Payment Content */}
        <div className="space-y-8">
          {/* Entry Fee Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
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
                  <strong>Player List:</strong> Be sure to include a list of the <strong>entry names</strong> that 
                  are being paid for when you submit any payment.
                </p>
              </div>
              
              {/* Payment Methods Sub-cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Electronic Payments */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Electronic Payments</h3>
                  </div>
                  <p className="text-gray-700 text-sm">
                    Electronic payments are preferred. Just be sure you are following the Terms & Conditions of the platform you are using.
                  </p>
                </div>

                {/* Cash Payments */}
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Cash</h3>
                  </div>
                  <p className="text-gray-700 text-sm">
                    Cash is welcome if you plan to see me or if you live nearby.
                  </p>
                </div>
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
        </div>
      </div>
    </div>
  );
}

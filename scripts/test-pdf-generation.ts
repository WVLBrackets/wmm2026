/**
 * Test script to verify Puppeteer PDF generation works locally
 * Run with: npx tsx scripts/test-pdf-generation.ts
 */

async function testPDFGeneration() {
  try {
    // Dynamically require puppeteer packages
    let puppeteer: any;
    let chromium: any;
    
    try {
      puppeteer = require('puppeteer-core');
      console.log('✓ puppeteer-core loaded successfully');
    } catch (error) {
      console.error('✗ Failed to load puppeteer-core:', error);
      process.exit(1);
    }
    
    try {
      chromium = require('@sparticuz/chromium');
      console.log('✓ @sparticuz/chromium loaded successfully');
    } catch (error) {
      console.error('✗ Failed to load @sparticuz/chromium:', error);
      process.exit(1);
    }

    // Configure Chromium
    if (chromium && typeof chromium.setGraphicsMode === 'function') {
      chromium.setGraphicsMode(false);
    }

    console.log('\nAttempting to launch browser...');

    const { resolvePdfBrowserLaunch } = await import('../src/lib/pdfBrowser');
    const launchConfig = await resolvePdfBrowserLaunch(chromium);
    console.log(
      `Using ${launchConfig.useServerlessChromium ? 'sparticuz' : 'local'} executable: ${launchConfig.executablePath}`,
    );

    // Launch browser
    const browser = await puppeteer.launch({
      args: launchConfig.args,
      defaultViewport: launchConfig.defaultViewport,
      executablePath: launchConfig.executablePath,
      headless: launchConfig.headless,
    });

    console.log('✓ Browser launched successfully');

    const page = await browser.newPage();
    console.log('✓ New page created');

    // Test with simple HTML
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test PDF</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            color: #333;
          }
        </style>
      </head>
      <body>
        <h1>PDF Generation Test</h1>
        <p>If you can see this in a PDF, Puppeteer is working correctly!</p>
        <p>Generated at: ${new Date().toISOString()}</p>
      </body>
      </html>
    `;

    await page.setContent(testHTML, { waitUntil: 'networkidle0' });
    console.log('✓ HTML content set');

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    console.log(`✓ PDF generated successfully (${pdf.length} bytes)`);

    // Save to file for verification
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(process.cwd(), 'test-output.pdf');
    fs.writeFileSync(outputPath, pdf);
    console.log(`✓ PDF saved to: ${outputPath}`);

    await browser.close();
    console.log('✓ Browser closed');

    console.log('\n✅ All tests passed! PDF generation is working correctly.');
    console.log(`\nYou can open ${outputPath} to verify the PDF looks correct.`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('executable')) {
        console.error('\n💡 Tip: You may need to:');
        console.error('   1. Install Chrome/Chromium on your system');
        console.error('   2. Set PUPPETEER_EXECUTABLE_PATH environment variable');
        console.error('   3. Or use the full path to Chrome in the script');
      }
    }
    
    process.exit(1);
  }
}

// Run the test
testPDFGeneration();


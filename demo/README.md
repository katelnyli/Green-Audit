# Eco Demo - Green Audit Test Website

A simple demonstration website designed to showcase various web performance optimization opportunities that the Green Audit tool can detect.

## Features Included (Intentionally Unoptimized)

### 1. **Image Optimization Opportunities**
   - Multiple PNG images instead of modern WebP format
   - Large image dimensions (400x300, 600x400 px)
   - Multiple blog post and product images
   - Could be optimized with:
     - Format conversion (PNG → WebP)
     - Responsive images with srcset
     - Lazy loading for below-fold images

### 2. **Render-Blocking Resources**
   - External font loading from Google Fonts in `<head>`
   - Analytics script in `<head>` (non-critical)
   - Multiple third-party scripts blocking page render
   - Could be optimized with:
     - Async/defer attributes on scripts
     - Font-display: swap or preload fonts
     - Moving non-critical scripts to the end

### 3. **CSS & JavaScript**
   - Unused CSS classes (.deprecated-class, .old-style, .unused-nav)
   - Synchronous tracking scripts
   - Could be optimized with:
     - Tree-shaking unused CSS
     - Code splitting for non-critical JavaScript
     - Minification

### 4. **General Performance Issues**
   - Multiple external dependencies
   - No compression strategies
   - Large CSS file with inefficient selectors
   - Could be optimized with:
     - Critical CSS extraction
     - CSS minification
     - Removal of unused styles

## How to Test

1. Start the Green Audit backend and frontend
2. Run an audit on this demo website (serve it locally or use a remote host)
3. The tool should detect:
   - Image format optimization opportunities
   - Render-blocking script removal
   - Font optimization suggestions
   - Unused CSS removal
   - Overall CO2 reduction potential

## Expected Green Audit Results

When audited, this website should report:
- ~30-40% potential CO2 reduction through image optimization
- ~15-20% reduction from deferring scripts
- ~10-15% reduction from font optimization
- **Total potential reduction: 50-70% of page carbon footprint**

## Running Locally

To serve this demo locally:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8080
```

Then audit `http://localhost:8080/demo/` in Green Audit.

## File Structure

```
demo/
├── index.html      # Main HTML with intentional performance issues
├── styles.css      # CSS with unused rules and optimization opportunities
└── README.md       # This file
```

## Notes

- This is a **demonstration website** intentionally designed to be sub-optimal
- Real websites should follow these best practices
- Use Green Audit to identify and fix these issues
- The goal is to show how Green Audit helps developers reduce carbon emissions

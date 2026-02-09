import Papa from 'papaparse';

/**
 * Generic CSV parser using PapaParse
 * Handles encoding issues and returns structured rows
 */
export class CSVParser {
  /**
   * Parse CSV file to rows
   * @param file CSV file to parse
   * @returns Promise resolving to array of row objects
   */
  async parse(file: File): Promise<Record<string, string>[]> {
    // First, read the file to check if first line is a title row
    const text = await file.text();
    const lines = text.split('\n');
    
    // Check if first line looks like a title (not CSV headers)
    // Title lines often start with "Realized" or contain report metadata
    let skipRows = 0;
    if (lines.length > 1 && lines[0]) {
      const firstLine = lines[0].trim();
      // If first line starts with quote and contains descriptive text, it's a title
      if (firstLine.startsWith('"Realized') || 
          firstLine.toLowerCase().includes('as of') ||
          (firstLine.startsWith('"') && firstLine.includes('from') && firstLine.includes('to'))) {
        skipRows = 1;
      }
    }

    // Create new file/blob if we need to skip rows
    let parseFile: File | Blob = file;
    if (skipRows > 0) {
      const newContent = lines.slice(skipRows).join('\n');
      parseFile = new Blob([newContent], { type: 'text/csv' });
    }

    return new Promise((resolve, reject) => {
      Papa.parse(parseFile as any, {
        header: true, // Use first row as headers
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().replace(/"/g, ''), // Remove whitespace and quotes
        transform: (value) => value.trim(), // Remove whitespace from values
        complete: (results) => {
          if (results.errors.length > 0) {
            // Filter out minor errors
            const criticalErrors = results.errors.filter(e => e.type !== 'FieldMismatch');
            if (criticalErrors.length > 0) {
              const errorMessages = criticalErrors
                .map((err) => `Row ${err.row}: ${err.message}`)
                .join('\n');
              reject(new Error(`CSV parsing errors:\n${errorMessages}`));
              return;
            }
          }

          resolve(results.data as Record<string, string>[]);
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }

  /**
   * Get headers from CSV file without parsing full content
   */
  async getHeaders(file: File): Promise<string[]> {
    // Read file and check for title row
    const text = await file.text();
    const lines = text.split('\n');
    
    let skipRows = 0;
    if (lines.length > 1 && lines[0]) {
      const firstLine = lines[0].trim();
      if (firstLine.startsWith('"Realized') || 
          firstLine.toLowerCase().includes('as of') ||
          (firstLine.startsWith('"') && firstLine.includes('from') && firstLine.includes('to'))) {
        skipRows = 1;
      }
    }

    let parseFile: File | Blob = file;
    if (skipRows > 0) {
      const newContent = lines.slice(skipRows).join('\n');
      parseFile = new Blob([newContent], { type: 'text/csv' });
    }

    return new Promise((resolve, reject) => {
      Papa.parse(parseFile as any, {
        header: true,
        preview: 1, // Only parse first row to get headers
        complete: (results) => {
          const headers = results.meta.fields || [];
          resolve(headers.map((h) => h.trim().replace(/"/g, '')));
        },
        error: (error) => {
          reject(new Error(`Failed to read CSV headers: ${error.message}`));
        },
      });
    });
  }
}

// Singleton instance
export const csvParser = new CSVParser();

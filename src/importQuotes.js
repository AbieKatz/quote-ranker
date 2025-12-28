import { database } from './firebase.js';
import { ref, push } from 'firebase/database';
import { readFileSync } from 'fs';

async function importQuotes() {
  console.log('Starting import...');
  
  let importedCount = 0;
  
  try {
    const quotesData = JSON.parse(readFileSync('src/quotes.json', 'utf8'));
    
    console.log(`Found ${quotesData.length} quotes to import`);
    
    for (const quote of quotesData) {
      const quoteData = {
        text: quote.text,
        author: quote.author,
        source: '',
        tags: quote.tags || '',
        votes: 0,
        timestamp: Date.now()
      };
      
      const quotesRef = ref(database, 'quotes');
      await push(quotesRef, quoteData);
      
      importedCount++;
      console.log(`Imported ${importedCount}/${quotesData.length}: "${quote.text.substring(0, 50)}..." - ${quote.author}`);
    }
    
    console.log(`\n✅ Successfully imported ${importedCount} quotes!`);
    
  } catch (error) {
    console.error('Error importing quotes:', error);
  }
}

importQuotes();
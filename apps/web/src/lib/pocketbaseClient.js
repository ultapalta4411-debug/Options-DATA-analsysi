import PocketBase from 'pocketbase';

const PB_BASE_URL = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090';

const pb = new PocketBase(PB_BASE_URL);

export default pb;

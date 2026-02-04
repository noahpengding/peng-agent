import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ModelInfo } from '../../components/ChatInterface.types';
import { ModelService } from '../../services/modelService';

interface ModelState {
  availableBaseModels: ModelInfo[];
  loading: boolean;
  error: string | null;
}

const initialState: ModelState = {
  availableBaseModels: [],
  loading: false,
  error: null,
};

export const fetchBaseModels = createAsyncThunk(
  'models/fetchBaseModels',
  async (_, { rejectWithValue }) => {
    try {
      return await ModelService.getAvailableBaseModels();
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const modelSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBaseModels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBaseModels.fulfilled, (state, action) => {
        state.loading = false;
        state.availableBaseModels = action.payload;
      })
      .addCase(fetchBaseModels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default modelSlice.reducer;

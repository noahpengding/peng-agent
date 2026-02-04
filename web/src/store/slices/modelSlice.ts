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
        state.availableBaseModels = Array.isArray(action.payload)
          ? (action.payload as ModelInfo[])
          : [];
      })
      .addCase(fetchBaseModels.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error?.message ?? 'Failed to fetch base models';
      });
  },
});

export default modelSlice.reducer;

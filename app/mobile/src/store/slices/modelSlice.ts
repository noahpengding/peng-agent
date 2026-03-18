import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ModelInfo } from '@/types/ChatInterface.types';
import { ModelService } from '../../services/modelService';
import { UserService } from '../../services/userService';

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

export interface FetchBaseModelsResult {
  models: ModelInfo[];
  defaultBaseModel: string | null;
}

export const fetchBaseModels = createAsyncThunk<FetchBaseModelsResult>('models/fetchBaseModels', async (_, { rejectWithValue }) => {
  try {
    const [models, profile] = await Promise.allSettled([ModelService.getAvailableBaseModels(), UserService.getProfile()]);
    return {
      models: models.status === 'fulfilled' ? models.value : [],
      defaultBaseModel: profile.status === 'fulfilled' ? (profile.value.default_base_model ?? null) : null,
    };
  } catch (error) {
    return rejectWithValue((error as Error).message);
  }
});

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
        state.availableBaseModels = action.payload.models;
      })
      .addCase(fetchBaseModels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default modelSlice.reducer;

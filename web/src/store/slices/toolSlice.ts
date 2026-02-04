import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Tool } from '../../components/ChatInterface.types';
import { ToolService } from '../../services/toolService';

interface ToolState {
  availableTools: Tool[];
  loading: boolean;
  error: string | null;
}

const initialState: ToolState = {
  availableTools: [],
  loading: false,
  error: null,
};

export const fetchTools = createAsyncThunk(
  'tools/fetchTools',
  async (_, { rejectWithValue }) => {
    try {
      return await ToolService.getAllTools();
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateTools = createAsyncThunk(
  'tools/updateTools',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      await ToolService.updateTools();
      // After successful update, fetch tools again
      dispatch(fetchTools());
      return;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const toolSlice = createSlice({
  name: 'tools',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTools.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTools.fulfilled, (state, action) => {
        state.loading = false;
        state.availableTools = action.payload || [];
      })
      .addCase(fetchTools.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateTools.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTools.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateTools.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default toolSlice.reducer;

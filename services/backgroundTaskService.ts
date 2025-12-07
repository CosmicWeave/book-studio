import { BackgroundTask, BackgroundTaskState } from '../types';
import { toastService } from './toastService';
import { db } from './db';

type Subscriber = (state: BackgroundTaskState) => void;

class BackgroundTaskService {
  private state: BackgroundTaskState = {
    currentTask: null,
    queue: [],
    progress: null,
    isProcessing: false,
  };
  private subscribers = new Set<Subscriber>();

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    callback(this.state);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    this.subscribers.forEach(callback => callback(this.state));
  }

  private setState(newState: Partial<BackgroundTaskState>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }
  
  public addTask(task: Omit<BackgroundTask, 'id'>) {
    const newTask: BackgroundTask = { ...task, id: crypto.randomUUID() };
    this.setState({
      queue: [...this.state.queue, newTask],
    });

    if (!this.state.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.state.queue.length === 0) {
      this.setState({ isProcessing: false, currentTask: null, progress: null });
      return;
    }

    this.setState({ isProcessing: true });
    const task = this.state.queue[0];
    this.setState({
      currentTask: task,
      queue: this.state.queue.slice(1),
    });

    try {
      const updateProgress = (message: string, current: number, total: number) => {
        this.setState({
          progress: {
            message,
            percentage: Math.round((current / total) * 100),
          },
        });
      };

      const result = await task.execute(updateProgress);
      
      if (task.bookId) {
        const book = await db.books.get(task.bookId);
        if (book) {
            toastService.success(`Finished: ${task.name}`);
        }
      } else {
        toastService.success(`Finished: ${task.name}`);
      }
      
      if (task.onComplete) {
        task.onComplete(result);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error(`Error processing task "${task.name}":`, error);
      toastService.error(`Task Failed: ${task.name}. ${message}`);
    }

    // Process next item in the queue
    this.processQueue();
  }
}

export const backgroundTaskService = new BackgroundTaskService();
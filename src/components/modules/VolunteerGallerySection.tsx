import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ImagePlus,
  Link2,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import MagneticButton from '../ui/MagneticButton';
import { CAMPUS_ALT_IMAGES, CAMPUS_IMAGE } from '../../lib/campusVisuals';
import { supabase, type VolunteerGalleryPhoto } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import './volunteer-gallery.css';

const STORAGE_BUCKET = 'volunteer-gallery';
const FALLBACK_IMAGES = [CAMPUS_IMAGE, ...CAMPUS_ALT_IMAGES].map((url, index) => ({
  id: `fallback-${index}`,
  title: index === 0 ? 'Campus Evenings' : `BITS Goa Frame ${index}`,
  caption: 'Reference campus visual',
  image_url: url,
  storage_path: null,
  user_id: 'fallback',
  created_at: new Date().toISOString(),
})) satisfies VolunteerGalleryPhoto[];

type UploadMode = 'file' | 'url';

export default function VolunteerGallerySection() {
  const { profile } = useAuthStore();
  const { addToast } = useToastStore();
  const dragStartX = useRef<number | null>(null);
  const [photos, setPhotos] = useState<VolunteerGalleryPhoto[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showUploader, setShowUploader] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const galleryPhotos = useMemo(() => (photos.length > 0 ? photos : FALLBACK_IMAGES), [photos]);

  useEffect(() => {
    void fetchPhotos();

    const channel = supabase
      .channel('volunteer-gallery-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'volunteer_gallery_photos' },
        () => {
          void fetchPhotos();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPhotos() {
    setLoading(true);
    const { data, error } = await supabase
      .from('volunteer_gallery_photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      addToast({
        type: 'error',
        title: 'Gallery load failed',
        message: error.message,
      });
      setLoading(false);
      return;
    }

    setPhotos((data as VolunteerGalleryPhoto[]) || []);
    setActiveIndex(0);
    setLoading(false);
  }

  function resetForm() {
    setTitle('');
    setCaption('');
    setImageUrl('');
    setSelectedFile(null);
    setUploadMode('file');
  }

  function moveIndex(direction: 1 | -1) {
    setActiveIndex((current) => {
      const total = galleryPhotos.length;
      if (total === 0) return 0;
      return (current + direction + total) % total;
    });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) < 14) return;
    moveIndex(event.deltaY > 0 ? 1 : -1);
  }

  async function uploadFileToStorage(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${profile?.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

    return { publicUrl, filePath };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      addToast({ type: 'error', title: 'Sign in required' });
      return;
    }

    if (!title.trim()) {
      addToast({ type: 'error', title: 'Add a title first' });
      return;
    }

    if (uploadMode === 'file' && !selectedFile) {
      addToast({ type: 'error', title: 'Choose an image to upload' });
      return;
    }

    if (uploadMode === 'url' && !imageUrl.trim()) {
      addToast({ type: 'error', title: 'Paste an image URL first' });
      return;
    }

    setSubmitting(true);

    try {
      let finalUrl = imageUrl.trim();
      let storagePath: string | null = null;

      if (uploadMode === 'file' && selectedFile) {
        const upload = await uploadFileToStorage(selectedFile);
        finalUrl = upload.publicUrl;
        storagePath = upload.filePath;
      }

      const { error } = await supabase.from('volunteer_gallery_photos').insert({
        user_id: profile.id,
        title: title.trim(),
        caption: caption.trim(),
        image_url: finalUrl,
        storage_path: storagePath,
      });

      if (error) {
        throw error;
      }

      addToast({
        type: 'success',
        title: 'Photo added to gallery',
      });
      resetForm();
      setShowUploader(false);
      await fetchPhotos();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      addToast({
        type: 'error',
        title: 'Gallery upload failed',
        message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const activePhoto = galleryPhotos[activeIndex] || galleryPhotos[0];

  return (
    <section className="mb-10">
      <GlassCard className="overflow-hidden" glow glowColor="rgba(198,127,87,0.18)">
        <div className="volunteer-gallery-shell">
          <div className="volunteer-gallery-copy">
            <span className="premium-label">
              <Sparkles size={12} />
              Volunteer Gallery
            </span>

            <h2 className="volunteer-gallery-title">A living photo wall for campus moments</h2>
            <p className="volunteer-gallery-text">
              Upload event frames and let the gallery behave like a tactile stack instead of
              another flat slider.
            </p>

            <div className="volunteer-gallery-metrics">
              <div className="premium-stat volunteer-gallery-stat">
                <span>Photos</span>
                <strong>{photos.length > 0 ? photos.length : FALLBACK_IMAGES.length}</strong>
              </div>
            </div>

            <div className="volunteer-gallery-actions">
              <MagneticButton size="sm" onClick={() => setShowUploader((current) => !current)}>
                <span className="flex items-center gap-2">
                  <ImagePlus size={14} />
                  {showUploader ? 'Hide Uploader' : 'Upload Photo'}
                </span>
              </MagneticButton>
              <button
                type="button"
                className="volunteer-gallery-nav volunteer-gallery-nav--inline"
                onClick={() => moveIndex(1)}
              >
                Next spread
                <ArrowRight size={15} />
              </button>
            </div>

            <AnimatePresence>
              {showUploader && (
                <motion.form
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onSubmit={handleSubmit}
                  className="volunteer-gallery-uploader"
                >
                  <div className="volunteer-gallery-mode">
                    <button
                      type="button"
                      className={uploadMode === 'file' ? 'active' : ''}
                      onClick={() => setUploadMode('file')}
                    >
                      <Upload size={14} />
                      Upload file
                    </button>
                    <button
                      type="button"
                      className={uploadMode === 'url' ? 'active' : ''}
                      onClick={() => setUploadMode('url')}
                    >
                      <Link2 size={14} />
                      Paste URL
                    </button>
                  </div>

                  <div className="volunteer-gallery-fields">
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Photo title"
                    />
                    <input
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="Short caption"
                    />
                    {uploadMode === 'file' ? (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      />
                    ) : (
                      <input
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="https://..."
                      />
                    )}
                  </div>

                  <div className="volunteer-gallery-upload-row">
                    <span className="volunteer-gallery-upload-hint">
                      Anyone signed in can add images to the volunteer gallery.
                    </span>
                    <button type="submit" disabled={submitting}>
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {submitting ? 'Uploading...' : 'Publish'}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <div className="volunteer-gallery-stage-wrap">
            {loading ? (
              <div className="volunteer-gallery-loading">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <>
                <div
                  className="volunteer-gallery-stage"
                  onWheel={handleWheel}
                  onPointerDown={(event) => {
                    dragStartX.current = event.clientX;
                  }}
                  onPointerUp={(event) => {
                    if (dragStartX.current === null) return;
                    const delta = event.clientX - dragStartX.current;
                    if (Math.abs(delta) > 36) {
                      moveIndex(delta < 0 ? 1 : -1);
                    }
                    dragStartX.current = null;
                  }}
                >
                  <div className="volunteer-gallery-perspective">
                    {galleryPhotos.map((photo, index) => {
                      const relative = index - activeIndex;
                      const total = galleryPhotos.length || 1;
                      const wrapped =
                        relative > total / 2
                          ? relative - total
                          : relative < -total / 2
                            ? relative + total
                            : relative;
                      const abs = Math.abs(wrapped);
                      const direction = wrapped < 0 ? -1 : 1;

                      return (
                        <motion.article
                          key={photo.id}
                          className={`volunteer-gallery-page ${abs === 0 ? 'is-active' : ''}`}
                          animate={{
                            x: wrapped * 96,
                            z: -abs * 120,
                            rotateY: wrapped * -18,
                            rotateZ: wrapped * direction * -1.8,
                            scale: abs === 0 ? 1 : 1 - Math.min(abs * 0.08, 0.24),
                            opacity: abs > 4 ? 0 : 1 - Math.min(abs * 0.16, 0.64),
                          }}
                          transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.7 }}
                          style={{ zIndex: galleryPhotos.length - abs }}
                        >
                          <div className="volunteer-gallery-page-edge" />
                          <img src={photo.image_url} alt={photo.title} draggable={false} />
                          <div className="volunteer-gallery-page-meta">
                            <p>{photo.title}</p>
                            <span>{photo.caption || 'Volunteer capture'}</span>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                </div>

                {activePhoto && (
                  <div className="volunteer-gallery-caption">
                    <div>
                      <p className="volunteer-gallery-caption-title">{activePhoto.title}</p>
                      <span>{activePhoto.caption || 'Captured for the volunteer gallery'}</span>
                    </div>
                    <div className="volunteer-gallery-stepper">
                      {galleryPhotos.map((photo, index) => (
                        <button
                          key={photo.id}
                          type="button"
                          className={index === activeIndex ? 'active' : ''}
                          onClick={() => setActiveIndex(index)}
                          aria-label={`Open photo ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </GlassCard>
    </section>
  );
}

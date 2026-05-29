/**
 * pdfCombined.question.js
 * Question module - handles PDF question extraction and processing
 * Depends on: pdfCombined.core.js
 */

pdfCombined.question = {
    init: function() {
        pdfCombined.core.listing.activate_file_list("pdf-question");
        this.bindGenerate();
        this.bindControls();
        this.ensureMoveButton();
    },

    /* ================================================================ */
    /* GENERATE ALL PAGES AT ONCE                                        */
    /* ================================================================ */
    bindGenerate: function() {
        $('#pdf-question .btn-generate').off('click').click(function() {
            $(`#pdf-question`).find(".viewTable").empty();
            let parent = $(this).closest("form").attr("id");
            if (jQuest.frm.validate(parent) == false) {
                jQuest.alert.d('Please fill up all information to start');
                return false;
            }
            var urlMain = $(`#${parent} .file_list`).attr('data-url') + $(`#${parent} .dir_list`).val() + "/" + $(`#${parent} .file_list`).val();
            pdfCombined.question.pdfToImagePages(urlMain, 'pdf-question');
        });
    },

    pdfToImagePages: function(pdfUrl, div) {
        function convertPdfToImages(pdfUrl, div) {
            return new Promise((resolve, reject) => {
                const SELECTOR = jQuest.getElement(div);
                if (SELECTOR === false) {
                    reject(new Error('Target div not found'));
                    return;
                }

                jQuest.circle.start();
                pdfjsLib.getDocument(pdfUrl).promise
                    .then(pdf => {
                        const numPages = pdf.numPages;

                        async function processPages() {
                            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                                try {
                                    const page = await pdf.getPage(pageNum);
                                    const desiredWidth = 2048;
                                    const originalViewport = page.getViewport({ scale: 1.0 });
                                    const scale = desiredWidth / originalViewport.width;
                                    const viewport = page.getViewport({ scale: scale });

                                    const canvas = document.createElement('canvas');
                                    const context = canvas.getContext('2d');
                                    canvas.height = viewport.height;
                                    canvas.width = viewport.width;

                                    await page.render({ canvasContext: context, viewport: viewport }).promise;

                                    const base64 = canvas.toDataURL('image/png');
                                    SELECTOR.find(".viewTable").append(`<img class="img-responsive" src="${base64}" />`);
                                } catch (error) {
                                    jQuest.notify.long.d(`Error processing page ${pageNum}:`, error);
                                    throw error;
                                }
                            }
                        }

                        return processPages();
                    })
                    .then(() => { resolve(); jQuest.circle.stop(); })
                    .catch(error => { console.error('Error converting PDF to images:', error); reject(error); jQuest.circle.stop(); });
            });
        }

        convertPdfToImages(pdfUrl, div)
            .then(() => {
                setTimeout(function() { pdfCombined.question.startjCropProcessing(div); }, 1000);
            })
            .catch(error => { console.error('PDF conversion failed:', error); });
    },

    /* ================================================================ */
    /* START JCROP + AUTO WRAP QBLOCKS                                   */
    /* ================================================================ */
    startjCropProcessing: function(div) {
        let splitCallback = function() { pdfCombined.question.shortDivProcessing(div); };

        let options = {
            new: true, save: false, update: false,
            remove: { start: true, auto: false, paper: false },
            blank: false, paper: "pdfpaper", process: true,
            callback: {
                crop: splitCallback,
                erase: false,
                split: splitCallback,
                merge: splitCallback,
                new: splitCallback,
                save: false,
                update: false,
                paper: false,
                remove: false
            },
            place: "top-right",
            rememberSelection: true,
        };

        jQuest.jCrop.init({
            elm: `#${div} .viewTable`,
            options: options,
            div: true,
            wrap: true,
            newOnly: false,
            activate: false
        });

        let SELECTOR = $("#pdf-question").find(".viewTable").first();
        if (SELECTOR.find('.qblock').length == 0) {
            SELECTOR.find('div.box-jcrop').each(function() {
                let $jcrop = $(this);
                $jcrop.wrap('<div class="box-body-question"></div>')
                    .parent()
                    .wrap('<div class="box box-widget border-purple qblock"></div>')
                    .parent()
                    .prepend('<div class="box-header border-bottom-gray"></div>')
                    .append('<div class="box-footer"></div>');
            });
            pdfCombined.question.activateShortBlockControls(SELECTOR);
            pdfCombined.core.shortQuestionNumber("pdf-question");
        }

        pdfCombined.question.shortDivProcessing(div);
    },

    shortDivProcessing: function(div) {
        let SELECTOR = $("#" + div).find(".viewTable").first();
        if (SELECTOR.length == 0) return false;

        /* Clean up orphaned wrappers */
        pdfCombined.core.cleanupOrphanedWrappers(SELECTOR);

        /* Wrap any orphaned .box-jcrop into new qblocks */
        let orphaned = false;
        $(SELECTOR).find('div.box-jcrop').each(function() {
            let $jcrop = $(this);
            if ($jcrop.closest('.qblock').length === 0) {
                orphaned = true;
                $jcrop.wrap('<div class="box-body-question"></div>')
                    .parent()
                    .wrap('<div class="box box-widget border-purple qblock"></div>')
                    .parent()
                    .prepend('<div class="box-header border-bottom-gray"></div>')
                    .append('<div class="box-footer"></div>');
            }
        });
        if (orphaned) {
            pdfCombined.question.activateShortBlockControls(SELECTOR);
            pdfCombined.core.shortQuestionNumber("pdf-question");
            
            /* RE-INITIALIZE JCROP ON ORPHANED IMAGES */
            let spec = { callback: { crop: () => pdfCombined.question.shortDivProcessing(div), split: () => pdfCombined.question.shortDivProcessing(div), new: () => pdfCombined.question.shortDivProcessing(div) } };
            pdfCombined.core.reinitializeJcropOnOrphaned(SELECTOR, div, spec);
        }

        let block = $(SELECTOR).find(".qblock");
        if (block.length == 0) return false;

        /* Header/footer click → toggle selection */
        $(".box-header,.box-footer", block).off("click").click(function(e) {
            e.stopPropagation();
            
            if (pdfCombined.core.shouldIgnoreClick(e.target)) return;
            
            let $thisQblock = $(this).closest('.qblock');
            pdfCombined.core.toggleBlockSelection('qblock', $thisQblock, SELECTOR);
            pdfCombined.question.checkMoveButton();
        });

        /* Question images: toggle selection + update move button */
        $(SELECTOR).find(".box-body-question > .box-jcrop").off("click").click(function(e) {
            e.stopPropagation();
            
            if (pdfCombined.core.shouldIgnoreClick(e.target)) return;
            
            $(this).toggleClass('border-blue-important');
            pdfCombined.question.checkMoveButton();
        });

        /* Add remove button to each box-jcrop */
        pdfCombined.core.setupRemoveBoxButtons(SELECTOR);

        pdfCombined.question.ensureMoveButton();
        pdfCombined.question.checkMoveButton();
        pdfCombined.core.bindSortBlocks(div, 'qblock', () => pdfCombined.core.shortQuestionNumber("pdf-question"));
    },

    /* ================================================================ */
    /* MOVE BUTTON (image → qblock)                                       */
    /* ================================================================ */
    ensureMoveButton: function() {
        if ($('#pdf-question-section .extrabtns .btn-move-img').length === 0) {
            $('#pdf-question-section .extrabtns').append(
                `<button type="button" class="btn btn-warning btn-sm btn-move-img hidden mar-left-5" title="Move selected image(s) to selected qblock">
                    <i class="fas fa-arrow-right"></i> Move
                </button>`
            );
            $('#pdf-question-section .btn-move-img').off('click').on('click', function() {
                pdfCombined.question.executeMove();
            });
        }
    },

    checkMoveButton: function() {
        let $qblock = $('#pdf-question-section .viewTable').first().find('.qblock.border-blue-important');
        let $imgs = $('#pdf-question-section .viewTable').first().find('div.box-jcrop.border-blue-important');
        if ($qblock.length === 1 && $imgs.length >= 1) {
            $('#pdf-question-section .btn-move-img').removeClass('hidden');
        } else {
            $('#pdf-question-section .btn-move-img').addClass('hidden');
        }
    },

    executeMove: function() {
        let $qblock = $('#pdf-question .viewTable').first().find('.qblock.border-blue-important').first();
        let $imgs = $('#pdf-question .viewTable').first().find('div.box-jcrop.border-blue-important');
        if (!$qblock.length || $imgs.length === 0) {
            jQuest.notify.short.d("Please select one destination qblock and at least one image to move.");
            return;
        }
        let $target = $qblock.find('.box-body-question').first();
        
        $imgs.each(function() {
            let $img = $(this);
            $img.removeClass('border-blue-important');
            if ($img.closest('.qblock')[0] === $qblock[0]) {
                return;
            }
            
            let $box = $img.closest('.box-jcrop');
            let jcropSpec = $box.find('img')[0].spec;
            
            $img.appendTo($target);
            
            if (jcropSpec) {
                jQuest.jCrop.common.destroyJcrop($img[0]);
                jQuest.jCrop.init({
                    elm: $box[0],
                    options: jcropSpec,
                    div: true,
                    wrap: false,
                    activate: false
                });
            }
            
            $img.off('click').on('click', function(e) {
                e.stopPropagation();
                if (pdfCombined.core.shouldIgnoreClick(e.target)) return;
                $(this).toggleClass('border-blue-important');
                pdfCombined.question.checkMoveButton();
            });
        });
        
        $qblock.removeClass('border-blue-important');
        pdfCombined.question.checkMoveButton();
        pdfCombined.core.bindSortBlocks('pdf-question', 'qblock', () => pdfCombined.core.shortQuestionNumber("pdf-question"));
        
        jQuest.notify.short.s(`Image(s) moved to Question ${$qblock.find('.questionNumber input').val() || ''}`);
    },

    /* ================================================================ */
    /* ACTIVATE QUESTION BLOCK CONTROLS                                  */
    /* ================================================================ */
    activateShortBlockControls: function(SELECTOR) {
        SELECTOR.find('.qblock').each(function() {
            let $qblock = $(this);
            let $header = $qblock.find('.box-header');

            if ($header.find('.questionNumber').length == 0) {
                $header.append(`<span class="questionNumber"><input type="number" style="width:60px;" value=""/></span>`);
            }
            if ($header.find('.questionTools').length == 0) {
                $header.append(`<div class="box-tools pull-right questionTools">
                    <button type="button" class="btn btn-box-tool btn-copy-block" title="Copy to Paper Queue"><i class="fa-2x fas fa-copy text-blue"></i></button>
                    <button type="button" class="btn btn-box-tool" data-widget="collapse"><i class="fa fa-minus"></i></button>
                    <button type="button" class="btn btn-box-tool btn-remove-block" data-widget="remove"><i class="fa-2x fas fa-times-circle text-red"></i></button>
                </div>`);
            }

            let $footer = $qblock.find('.box-footer');
            if ($footer.find('input.marks').length == 0) {
                $footer.append(`<strong>Marks:</strong> <input type="number" class="marks" style="width:60px;" value=""/>`);
            }
        });

        SELECTOR.find('.qblock .btn-remove-block').off('click').click(function() {
            $(this).closest('.qblock').remove();
            pdfCombined.core.shortQuestionNumber("pdf-question");
            pdfCombined.question.checkMoveButton();
        });

        SELECTOR.find('.qblock .btn-copy-block').off('click').click(function(e) {
            e.stopPropagation();
            let $qblock = $(this).closest('.qblock');
            pdfCombined.question.copyBlock($qblock);
        });

        $(".icheck", SELECTOR).iCheck({ checkboxClass: 'icheckbox_square', radioClass: 'iradio_square' });

        SELECTOR.find('[data-widget="collapse"]').off('click').click(function(e) {
            e.stopPropagation();
            let $box = $(this).closest('.box');
            let $icon = $(this).find('i');
            if ($box.hasClass('collapsed-box')) {
                $box.removeClass('collapsed-box');
                $box.find('.box-body-question, .box-footer').slideDown();
                $icon.removeClass('fa-plus').addClass('fa-minus');
            } else {
                $box.addClass('collapsed-box');
                $box.find('.box-body-question, .box-footer').slideUp();
                $icon.removeClass('fa-minus').addClass('fa-plus');
            }
        });
    },

    copyBlock: function($block) {
        let qNum = $block.find('.questionNumber input').val() || '0';

        $block.removeClass('border-blue-important shadow');
        $block.find('.border-blue-important, .shadow').removeClass('border-blue-important shadow');

        let jcropSpec = null;
        let $img = $block.find('img').first();
        if ($img.length && $img[0].spec) {
            jcropSpec = $img[0].spec;
        }

        let $paperClone = $block.clone();
        $paperClone.find('[id]').removeAttr('id');
        $paperClone.find('.mycrop-split-div, .mycrop-crop-div, .mycrop-erase-div, .mycrop-new-div, .mycrop-remove-div, .btn-remove-box').remove();
        $paperClone.find('.box-jcrop').removeClass('jcrop-active shadow border-box border-blue-important');

        let $paperViewTable = $('#pdf-paper-question .viewTable').first();
        $paperViewTable.append($paperClone);

        pdfCombined.question.activateShortBlockControls($($paperClone).parent());
        
        if (jcropSpec) {
            $paperClone.find('div.box-jcrop').each(function() {
                jQuest.jCrop.init({
                    elm: $(this)[0],
                    options: jcropSpec,
                    div: true,
                    wrap: false,
                    activate: false
                });
            });
        }
        
        pdfCombined.paper.shortDivProcessing('pdf-paper-question');
        pdfCombined.core.bindSortBlocks('pdf-paper-question', 'qblock', () => pdfCombined.core.shortQuestionNumber("pdf-paper-question"));

        let $placeholder = $(`<div class="unhide-placeholder text-center" style="border:2px dashed #ccc; margin:10px 0; padding:20px; background:#f9f9f9;">
            <span class="label label-success mar-right-5">COPIED</span>
            <button type="button" class="btn btn-sm btn-default btn-unhide bg-olive"><i class="fas fa-eye"></i> Unhide QP-${qNum}</button>
            <button type="button" class="btn btn-sm btn-default btn-remove-label bg-red"><i class="fas fa-eye"></i> Remove this</button>
        </div>`);

        $block.replaceWith($placeholder);
        $placeholder.data('detached-block', $block);
        $placeholder.data('jcrop-spec', jcropSpec);

        pdfCombined.core.shortQuestionNumber("pdf-question");

        $placeholder.find('.btn-unhide').off('click').on('click', function() {
            pdfCombined.question.unhideBlock($(this).closest('.unhide-placeholder'));
        });
        $placeholder.find('.btn-remove-label').off('click').on('click', function() {
            $(this).closest('.unhide-placeholder').remove();
            pdfCombined.core.shortQuestionNumber("pdf-question");
        });

        jQuest.notify.short.s(`Question block ${qNum} copied to paper queue (QP-${qNum}).`);
    },

    unhideBlock: function($placeholder) {
        let $detached = $placeholder.data('detached-block');
        if (!$detached || $detached.length === 0) {
            jQuest.notify.short.d("Item not found.");
            return;
        }

        $placeholder.replaceWith($detached);

        let jcropSpec = $placeholder.data('jcrop-spec');
        if (jcropSpec) {
            $detached.find('div.box-jcrop').each(function() {
                if (!$(this).find('img')[0].spec) {
                    jQuest.jCrop.init({
                        elm: $(this)[0],
                        options: jcropSpec,
                        div: true,
                        wrap: false,
                        activate: false
                    });
                }
            });
        }

        pdfCombined.question.activateShortBlockControls($($detached).parent());
        pdfCombined.core.shortQuestionNumber("pdf-question");
        pdfCombined.core.bindSortBlocks('pdf-question', 'qblock', () => pdfCombined.core.shortQuestionNumber("pdf-question"));

        jQuest.notify.short.s(`Question block unhidden.`);
    },

    bindControls: function() {
        $("#pdf-question-section .btn-clear-all").off("click").click(function() {
            let frm = $(this).closest("form").attr("id") || 'pdf-question';
            $(".box-jcrop", `#${frm} .viewTable`).removeClass("shadow border-box border-blue-important");
            pdfCombined.question.checkMoveButton();
        });

        $("#pdf-question-section .btn-active-split").off("click").click(function() {
            let $visibleSplitBtn = $('.btn-split-run:not(.hidden)');
            if ($visibleSplitBtn.length === 1) { $visibleSplitBtn.click(); }
            else { jQuest.notify.short.d("Please active split mode first and active only one split mode."); }
        });

        $("#pdf-question-section .btn-active-crop").off("click").click(function() {
            let $visibleCropBtn = $('.btn-crop-run:not(.hidden)');
            if ($visibleCropBtn.length === 1) {
                $('html, body').animate({ scrollTop: $visibleCropBtn.closest(".qblock,.box-jcrop").offset().top }, 1000);
                $visibleCropBtn.click();
            } else {
                jQuest.notify.short.d("Please active CROP mode first and active only one CROP mode.");
            }
        });

        $("#pdf-question-section .btn-newblock").off("click").on("click", function() {
            pdfCombined.question.addNewBlankBlock();
        });

        $("#pdf-question-section .btn-tab-question-jcrop").off("click").on("click", function() {
            pdfCombined.paper.initJCropOnLoaded('pdf-question');
        });
    },

    addNewBlankBlock: function() {
        let SELECTOR = $("#pdf-question").find(".viewTable").first();
        if (SELECTOR.length === 0) {
            jQuest.notify.short.d("View table not found.");
            return;
        }

        let $newBlock = $(`
            <div class="box box-widget border-purple qblock">
                <div class="box-header border-bottom-gray">
                    <span class="questionNumber"><input type="number" style="width:60px;" value=""/></span>
                    <div class="box-tools pull-right questionTools">
                        <button type="button" class="btn btn-box-tool btn-copy-block" title="Copy to Paper Queue">
                            <i class="fa-2x fas fa-copy text-blue"></i>
                        </button>
                        <button type="button" class="btn btn-box-tool" data-widget="collapse">
                            <i class="fa fa-minus"></i>
                        </button>
                        <button type="button" class="btn btn-box-tool btn-remove-block" data-widget="remove">
                            <i class="fa-2x fas fa-times-circle text-red"></i>
                        </button>
                    </div>
                </div>
                <div class="box-body-question"></div>
                <div class="box-footer">
                    <strong>Marks:</strong> <input type="number" class="marks" style="width:60px;" value=""/>
                </div>
            </div>
        `);

        let $selectedQblock = SELECTOR.find('.qblock.border-blue-important').first();
        let $firstBlock = SELECTOR.find('.qblock:first');

        if ($selectedQblock.length === 1) {
            $newBlock.insertAfter($selectedQblock);
        } else {
            if ($firstBlock.length === 0){SELECTOR.prepend($newBlock);}
            else{$firstBlock.before($newBlock);}
        }

        pdfCombined.question.activateShortBlockControls($newBlock.parent());
        pdfCombined.core.shortQuestionNumber("pdf-question");
        pdfCombined.question.shortDivProcessing("pdf-question");

        $('html, body').animate({
            scrollTop: $newBlock.offset().top - 100
        }, 500);

        jQuest.notify.short.s("New blank question block added.");
    }
};

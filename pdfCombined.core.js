/**
 * pdfCombined.core.js
 * Core module containing shared utilities and common functions
 * Used by question, answer, and paper modules
 */

const pdfCombined = {
    core: {
        /* ================================================================ */
        /* COMMON LISTING UTILITIES (shared across all modules)              */
        /* ================================================================ */
        listing: {
            get_file_list: function(tp = "question") {
                if ($(`#${tp} .dir_list`).val() == 0) {
                    jQuest.alert.d("You have not selected any subject! Aborting ....");
                    return false;
                }
                jQuest.ajax.send({
                    data: { dir: $(`#${tp} .dir_list`).val(), operation: "GET" },
                    action: $(`#pdf-${tp}-action [name="list"]`).val(),
                    url: `admin`,
                    div: `#${tp} .file_list`,
                    callback: function() { 
                        $(`#${tp} .file_list`).select2({ placeholder: "Select PDF" }); 
                    },
                    divClean: true,
                    consoleResponse: false
                });
            },

            remove_file_list: function(tp = "question") {
                if ($(`#${tp} .dir_list`).val() == 0) {
                    jQuest.alert.d("You have not selected any subject! Aborting ....");
                    return false;
                }
                var list = {
                    outgroup: ($(`#${tp} .file_list`).val()).split(`/`)[0],
                    option: $(`#${tp} .file_list`).val()
                };
                jQuest.ajax.confirm({
                    data: { dir: $(`#${tp} .dir_list`).val(), file: $(`#${tp} .file_list`).val(), operation: "REMOVE" },
                    action: $(`#pdf-${tp}-action [name="list"]`).val(),
                    url: $(`#${tp}`).attr('action').split("/").pop(),
                    callback: function() {
                        pdfCombined.core.listing.rearrange_file_list({ outgroup: list.outgroup, option: list.option, tp: tp });
                    },
                    title: "Are you sure to remove this file?",
                    content: "This action can not be undone!"
                });
            },

            activate_file_list: function(tp = "pdf-question") {
                $(`#${tp} .dir_list`).change(function() {
                    if ($(this).val() == 0) {
                        $(`#${tp} .file_list`).html(`<option value="0">Select PDF</option>`);
                        return false;
                    }
                    pdfCombined.core.listing.get_file_list(tp.replace('pdf-', ''));
                });
                $(`#${tp} .pdfRemove`).off("click").click(function() { 
                    pdfCombined.core.listing.remove_file_list(tp.replace('pdf-', '')); 
                });
            },

            rearrange_file_list: function({ outgroup = false, option = false, tp = false }) {
                if (!outgroup || !option) return false;
                var $optionToRemove = $(`#${tp} .file_list option[value="${option}"]`);
                var $nextOption;
                if ($optionToRemove.next().length > 0) {
                    $nextOption = $optionToRemove.next();
                } else if ($optionToRemove.prev().length > 0) {
                    $nextOption = $optionToRemove.prev();
                } else if ($optionToRemove.parent().next().length > 0 &&
                    $optionToRemove.parent().next().find("option:first").length > 0) {
                    $nextOption = $optionToRemove.parent().next().find("option:first");
                } else if ($optionToRemove.parent().prev().length > 0 &&
                    $optionToRemove.parent().prev().find("option:first").length > 0) {
                    $nextOption = $optionToRemove.parent().prev().find("option:first");
                } else {
                    $nextOption = $(`#${tp} .file_list`).find("option:first");
                }
                if ($nextOption.length > 0) { $nextOption.prop("selected", true); }
                $optionToRemove.remove();
                var SELECTOR = $(`#${tp} .file_list label[attribute="${outgroup}"]`);
                if ($(SELECTOR).children().length == 0) { $(SELECTOR).remove(); }
                $(`#${tp} .viewTable`).empty();
                $(`#${tp} .pages`).empty();
            }
        },

        /* ================================================================ */
        /* BLOCK NUMBERING UTILITIES                                         */
        /* ================================================================ */
        shortQuestionNumber: function(frm) {
            let $viewTable = $(`#${frm}`).find('.viewTable').first();
            if (!$viewTable.length) return;
            
            $viewTable.children('div').each(function(index) {
                let $child = $(this);
                let serialNum = index + 1;
                
                $child.attr('data-question-number', serialNum);
                
                if ($child.hasClass('qblock')) {
                    $child.find('.box-header .questionNumber input').val(serialNum);
                }
            });
        },

        answerBlockNumber: function(div) {
            let $viewTable = $(`#${div} .viewTable`).first();
            if (!$viewTable.length) return;
            
            $viewTable.children('div').each(function(index) {
                let $child = $(this);
                let serialNum = index + 1;
                
                $child.attr('data-answer-number', serialNum);
                
                if ($child.hasClass('answer-block')) {
                    $child.find('.box-header .answerNumber input').val(serialNum);
                    $child.find('.answer-block-footer').text(`answer-${serialNum}`);
                }
            });
        },

        /* ================================================================ */
        /* CLICK EVENT PREVENTION HELPERS                                    */
        /* ================================================================ */
        shouldIgnoreClick: function(target) {
            // Returns true if click should be ignored (button, input, jCrop controls, etc.)
            if ($(target).is('button') || $(target).closest('button').length > 0) return true;
            if ($(target).is('input') || $(target).closest('input').length > 0) return true;
            if ($(target).closest('.j-operation').length > 0) return true;
            if ($(target).closest('.mycrop-split-div, .mycrop-crop-div, .mycrop-erase-div, .mycrop-new-div, .mycrop-remove-div, .btn-remove-box').length > 0) return true;
            return false;
        },

        /* ================================================================ */
        /* ORPHANED WRAPPER CLEANUP                                          */
        /* ================================================================ */
        cleanupOrphanedWrappers: function(SELECTOR) {
            $(SELECTOR).find(`.box-jcrop`).each(function() {
                let $parent = $(this).parent();
                if (!$parent.length || $parent.hasClass('box-body-question') || $parent.hasClass('box-body-answer') || $parent.hasClass('viewTable') || $parent.hasClass('qblock') || $parent.hasClass('answer-block')) return;
                let $children = $parent.children('.box-jcrop');
                if ($children.length > 0) { $children.unwrap(); $parent.remove(); }
            });
        },

        /* ================================================================ */
        /* JCROP RE-INITIALIZATION FOR ORPHANED IMAGES                       */
        /* ================================================================ */
        reinitializeJcropOnOrphaned: function(SELECTOR, div, spec) {
            $(SELECTOR).find('div.box-jcrop').each(function() {
                if (!$(this).find('img')[0].spec) {
                    let jcropSpec = {
                        new: true, save: false, update: false,
                        remove: { start: true, auto: false, paper: false },
                        blank: false, paper: "pdfpaper", process: true,
                        callback: {
                            crop: () => spec.callback.crop ? spec.callback.crop() : null,
                            erase: false,
                            split: () => spec.callback.split ? spec.callback.split() : null,
                            merge: false,
                            new: () => spec.callback.new ? spec.callback.new() : null,
                            save: false, update: false, paper: false, remove: false
                        },
                        place: "top-right",
                        rememberSelection: true
                    };
                    jQuest.jCrop.init({
                        elm: $(this)[0],
                        options: jcropSpec,
                        div: true,
                        wrap: false,
                        activate: false
                    });
                }
            });
        },

        /* ================================================================ */
        /* SORTABLE BLOCKS SETUP                                             */
        /* ================================================================ */
        bindSortBlocks: function(div, blockType = 'qblock', numberingFn = null) {
            const bodySelector = blockType === 'qblock' ? '.box-body-question' : '.box-body-answer';
            const containerSelector = `#${div} .viewTable`;
            
            try {
                $(`.${blockType} ${bodySelector}`).sortable("destroy");
                $(containerSelector).sortable("destroy");
            } catch(e) { }
            
            $(`.${blockType} ${bodySelector}`).sortable({
                connectWith: `.${blockType} ${bodySelector}`,
                items: "> .box-jcrop",
                placeholder: "ui-state-highlight",
                revert: true,
                handle: "img",
                stop: function() { 
                    if (numberingFn) numberingFn();
                }
            });
            
            $(containerSelector).sortable({
                items: `> .${blockType}`,
                handle: ".box-header",
                placeholder: "ui-state-highlight",
                stop: function() {
                    if (numberingFn) numberingFn();
                }
            });
        },

        /* ================================================================ */
        /* REMOVE BOX BUTTONS SETUP                                          */
        /* ================================================================ */
        setupRemoveBoxButtons: function(SELECTOR) {
            $(SELECTOR).find(`.btn-remove-box`).remove();
            $(SELECTOR).find("div.box-jcrop").find(`.mycrop-remove-div`).append(
                `<a class="btn btn-default btn-sm btn-flat btn-remove-box mar-left-5 bg-red" title="Remove the image directly" href="javascript:"><i class="fas fa-times-circle"></i></a>`
            );
            $(SELECTOR).find("div.box-jcrop").find(`.mycrop-remove-div`).off("click").on("click", `.btn-remove-box`, function() {
                $(this).closest('.box-jcrop').remove();
            });
        },

        /* ================================================================ */
        /* BLOCK SELECTION TOGGLE (auto-unselect others)                     */
        /* ================================================================ */
        toggleBlockSelection: function(blockClass, $thisBlock, $viewTable) {
            if (!$thisBlock.hasClass('border-blue-important')) {
                $viewTable.find(`.${blockClass}.border-blue-important`).removeClass('border-blue-important');
            }
            $thisBlock.toggleClass('border-blue-important');
        }
    }
};
